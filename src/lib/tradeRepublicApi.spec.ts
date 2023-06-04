import anyTest, { TestInterface } from 'ava';
import getPort from 'get-port';
import { Server } from 'ws';
import { TradeRepublicApi } from './tradeRepublicApi';

interface CustomContext {
  wss: Server;
  endpoint: string;
}

const test = anyTest as TestInterface<CustomContext>;

function setUpServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    try {
      const wss = new Server(
        {
          port,
        },
        () => {
          resolve(wss);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

test.beforeEach(async (t) => {
  const port = await getPort();
  t.context.wss = await setUpServer(port);
  t.context.endpoint = `ws://localhost:${port}`;
});

test.afterEach.always((t) => {
  t.context.wss.close();
  t.context.endpoint = null;
});

function waitForServerMessage(wss: Server): Promise<string> {
  return new Promise((resolve) => {
    wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        // console.log(`Message received: ${message}`);
        resolve(message.toString());
      });
    });
  });
}

function waitForClientEvent(
  tr: TradeRepublicApi,
  eventName: string
): Promise<any> {
  return new Promise((resolve) => {
    tr.on(eventName, (event) => {
      // console.log(`Event fired: ${eventName}`);
      resolve(event);
    });
  });
}

test('static - message history is initially empty', (t) => {
  const trapi = new TradeRepublicApi();
  const response = trapi.getSentMessages();
  t.is(response.size, 0);
});

test('websocket connect - correct initialization message', async (t) => {
  const TR_INIT_REGEX = RegExp(`connect 26 \\{"locale":".*"\\}`);
  // delay connect until server is ready
  const trapi = new TradeRepublicApi({
    apiEndpoint: t.context.endpoint,
  });
  trapi.connect();
  const receivedClientMessage = await waitForServerMessage(t.context.wss);
  t.regex(receivedClientMessage, TR_INIT_REGEX);
});

test('websocket connect - trigger connect event', async (t) => {
  t.context.wss.on('connection', (ws) => {
    ws.on('message', () => {
      ws.send('connected');
      ws.close();
    });
  });
  const trapi = new TradeRepublicApi({
    apiEndpoint: t.context.endpoint,
  });
  trapi.connect();
  await waitForClientEvent(trapi, 'connected');
  t.pass();
});

test('websocket oneShot - message is formatted correctly', async (t) => {
  const msg = `1 cash ${JSON.stringify({
    test: 'test',
  })}`;

  const msgClient = `sub 1 ${JSON.stringify({
    type: 'cash',
    token: '',
    test: 'test',
  })}`;

  interface TestResponse {
    test: string;
  }

  t.context.wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      if (message.toString().indexOf('connect 26') > -1) {
        ws.send('connected');
      } else if (message.toString() == msgClient) {
        ws.send(msg);
        ws.close();
      }
    });
  });

  const trapi = new TradeRepublicApi({
    apiEndpoint: t.context.endpoint,
  });
  trapi.connect();

  await waitForClientEvent(trapi, 'connected');
  const data = await trapi.oneShot<TestResponse>('cash', { test: 'test' });
  t.is(data.subId, 1);
  t.is(data.type, 'cash');
  t.is(data.payload.test, 'test');
});

test('subTicker', async (t) => {
  const msg = `1 ticker ${JSON.stringify({
    bid: {
      price: 100,
    },
    ask: 'tps',
    last: 'tps',
    pre: 'tps',
    open: 'tps',
    qualityId: 'string',
    leverage: 'string',
    delta: 'string',
  })}`;

  const msgClient = `sub 1 ${JSON.stringify({
    type: 'ticker',
    token: '',
    id: 'US1234567890.LSX',
  })}`;

  t.context.wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      if (message.toString().indexOf('connect 26') > -1) {
        ws.send('connected');
      } else if (message == msgClient) {
        ws.send(msg);
        ws.close();
      }
    });
  });

  const trapi = new TradeRepublicApi({
    apiEndpoint: t.context.endpoint,
  });
  trapi.connect();

  await waitForClientEvent(trapi, 'connected');
  const subId = trapi.subTicker('US1234567890');
  const ticker = await waitForClientEvent(trapi, 'ticker');
  t.is(ticker.subId, subId);
  t.is(ticker.type, 'ticker');
  t.is(ticker.payload.bid.price, 100);
});
