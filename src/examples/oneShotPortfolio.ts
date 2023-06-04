import {
  Message,
  TimelineEvent,
  TimeLineResponse,
  TradeRepublicApi,
  TradeRepublicMessageType,
} from '..';

(() => {
  const trapi = new TradeRepublicApi({});

  trapi.on('connected', async () => {
    await trapi.login('+1234567890123', '1234');
    const allTimeLineEvents = await getAllEntries('timeline');
    console.log(allTimeLineEvents);
    trapi.disconnect();
  });

  trapi.connect();

  /**
   * use pagination to get all entities for a given message type (if supported, e.g. timeline)
   * @param type message type
   * @param after after eventId
   * @returns all entries for a request
   */
  async function getAllEntries(
    type: TradeRepublicMessageType,
    after = null
  ): Promise<TimelineEvent[]> {
    // console.log('request', type, after);
    let response: Message<TimeLineResponse>;
    if (after === null) {
      response = await trapi.oneShot<TimeLineResponse>(type, {});
    } else {
      response = await trapi.oneShot<TimeLineResponse>(type, {
        after,
      });
    }
    const events = response.payload.data;
    if (response.payload.cursors && response.payload.cursors.after != null) {
      const afterEvents = await getAllEntries(
        type,
        response.payload.cursors.after
      );
      if (afterEvents && afterEvents.length > 0) {
        return [...events, ...afterEvents];
      }
    }
    return events;
  }
})();
