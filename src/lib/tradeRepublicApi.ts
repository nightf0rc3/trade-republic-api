import axios, { AxiosInstance } from 'axios';
import EventEmitter from 'events';
import { parse } from 'set-cookie-parser';
import WebSocket from 'ws';
import {
  ProcessResponse,
  TradeRepublicMessageType,
} from './tradeRepublicInterfaces';
import { convertArrayToMap, waitForInput } from './utils';

export interface Message<T> {
  subId: number;
  type: string;
  payload: T;
}

export interface Options {
  locale: string;
  apiEndpoint: string;
  apiEndpointWeb: string;
  keepSentMessageHistory: boolean;
  autoReconnect: boolean;
}

export class TradeRepublicApi extends EventEmitter {
  private ws: WebSocket;
  private instance: AxiosInstance;
  private subCounter = 1;

  private locale = '';
  private sessionToken = '';
  private sentMessages = new Map<number, unknown>();
  private keepSentMessageHistory = false;
  private autoReconnect = false;
  private apiEndpoint = '';
  private apiEndpointWeb = '';

  private static DEFAULT_LOCALE = 'de';
  private static DEFAULT_APIENDPOINT = 'wss://api.traderepublic.com';
  private static DEFAULT_APIENDPOINT_WEB =
    'https://api.traderepublic.com/api/v1';
  private static CONNECTED_CONFIRMED_MSG = 'connected';

  constructor(options?: Partial<Options>) {
    super();
    this.locale = options?.locale || TradeRepublicApi.DEFAULT_LOCALE;
    this.keepSentMessageHistory = options?.keepSentMessageHistory || false;
    this.autoReconnect = options?.autoReconnect || false;
    this.apiEndpoint =
      options?.apiEndpoint || TradeRepublicApi.DEFAULT_APIENDPOINT;
    this.apiEndpointWeb =
      options?.apiEndpointWeb || TradeRepublicApi.DEFAULT_APIENDPOINT_WEB;
  }

  /**
   * establish a connection to the Trade Republic websocket
   */
  public connect() {
    this.subCounter = 1;
    this.ws = new WebSocket(this.apiEndpoint);
    this.ws.on('open', () => {
      this.send(`connect 26 ${JSON.stringify({ locale: this.locale })}`);
    });
    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });
    this.ws.on('close', () => {
      this.emit('close');
      if (this.autoReconnect) {
        this.subCounter = 0;
        this.connect();
        // TODO: re-subscribe active subscriptions?
      }
    });
  }

  public disconnect() {
    this.ws.terminate();
  }

  /**
   * authenticate the currently active session
   * @param phoneNumber phone number
   * @param pin pin number
   */
  public async login(phoneNumber: string, pin: string) {
    this.instance = axios.create({
      baseURL: this.apiEndpointWeb,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    try {
      // perform initial login
      const loginResponse = await this.instance.post<ProcessResponse>(
        '/auth/web/login',
        {
          phoneNumber,
          pin,
        }
      );
      const { data } = loginResponse;
      // get CLI input for 2FA code
      const twoFaCode = await waitForInput(
        `Please enter the 2FA code you received on your phone (valid for ${data.countdownInSeconds} seconds)`,
        data.countdownInSeconds
      );
      // use 2FA token to get session token
      const twoFaResponse = await this.instance.post<ProcessResponse>(
        `/auth/web/login/${data.processId}/${twoFaCode}`
      );
      // extract session token from cookie header
      const { headers } = twoFaResponse;
      const cookies = parse(headers['set-cookie']);
      const cookieMap = convertArrayToMap(cookies);
      this.sessionToken = cookieMap['tr_session'].value;
    } catch (e) {
      console.log('Login failed: "' + e.message + '"');
      throw new Error(e);
    }
  }

  /**
   * supply increasing subscription Ids
   * @returns next subscription Id to be used
   */
  private getNextSubId() {
    const current = this.subCounter;
    this.subCounter++;
    return current;
  }

  /**
   * subscribe to the ticker topic of isin
   * @param isin isin
   * @param exchangeId exchangeId, only LSX is supported for now
   * @returns subscriptionId
   */
  public subTicker(isin: string, exchangeId = 'LSX') {
    return this.sub('ticker', { id: `${isin}.${exchangeId}` });
  }

  /**
   * subscribe to a topic by type and specify payload
   * @param type message type
   * @param payload message payload
   * @returns subscriptionId
   */
  public sub(type: TradeRepublicMessageType, payload: any) {
    const subId = this.getNextSubId();
    const msg = `sub ${subId} ${JSON.stringify({
      type,
      token: this.sessionToken,
      ...payload,
    })}`;
    this.sentMessages.set(subId, { type, payload });
    this.send(msg);
    return subId;
  }

  /**
   * subscribe to a topic and wait for a single response
   * @param type message type
   * @param payload message payload
   * @returns response data
   */
  public async oneShot<T>(
    type: TradeRepublicMessageType,
    payload
  ): Promise<Message<T>> {
    const subId = this.sub(type, payload);
    return new Promise((resolve) => {
      const func = (data) => {
        resolve(data);
        this.removeListener(`sub#${subId}`, func);
        this.send(`unsub ${subId}`);
      };
      this.on(`sub#${subId}`, func);
    });
  }

  /**
   * emit an event only when they are listened for
   * @param eventName name of the event
   * @param data payload of the event
   */
  private emitIfSubbed(eventName: string, data: unknown) {
    if (this.eventNames().indexOf(eventName) > -1) {
      this.emit(eventName, data);
    }
  }

  /**
   * get all messages that have been sent to the websocket
   * empty if `keepSentMessageHistory` is not enabled
   * @returns map linking subscription Ids to request payloads
   */
  public getSentMessages() {
    return this.sentMessages;
  }

  /**
   * process an incoming message
   * @param data raw received websocket message
   */
  private handleMessage(data: WebSocket.Data) {
    this.emitIfSubbed('data', data);
    if (data == TradeRepublicApi.CONNECTED_CONFIRMED_MSG) {
      this.emit('connected');
    } else {
      try {
        const parsed = this.processNewMessage(data.toString());
        const { subId } = parsed;

        const request = this.sentMessages.get(subId);
        if (!this.keepSentMessageHistory) {
          this.sentMessages.delete(subId);
        }

        this.emitIfSubbed(`sub#${subId}`, { request, ...parsed });
        // TODO: better ticker filter
        if (data.toString().indexOf('bid":') > -1) {
          this.emitIfSubbed('ticker', { request, ...parsed });
        } else if (data.toString().indexOf('expectedClosingTime') > -1) {
          this.emitIfSubbed('historical', { request, ...parsed });
        }
      } catch (error) {
        this.emit(`error`, { error, data });
      }
    }
  }

  /**
   * sends a message to the Websocket
   * @param msg message string
   */
  private send(msg: string) {
    this.ws.send(msg);
    this.emitIfSubbed('sent', msg);
  }

  /**
   * extracts structured data from an incoming message
   * @param data raw received data
   * @returns Message obj containing subId, type and payload
   */
  private processNewMessage<T>(data: string): Message<T> {
    const parts = data.split(' ');
    const subId = parseInt(parts[0]);
    const type = parts[1];

    let payload;
    if (parts.length > 2) {
      const [, , ...rest] = parts;
      payload = JSON.parse(rest.join(''));
    }
    return {
      subId,
      type,
      payload: payload,
    };
  }
}
