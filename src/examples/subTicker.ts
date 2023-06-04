import { Message, Ticker, TradeRepublicApi } from '..';

(() => {
  const trapi = new TradeRepublicApi({
    keepSentMessageHistory: true,
  });

  trapi.on('connected', async () => {
    trapi.subTicker('US90364P1057');
  });

  trapi.on('ticker', async (data: Message<Ticker>) => {
    console.log(JSON.stringify(data));
    console.log(`Ask Price: ${data.payload.ask.price}`);
    console.log(trapi.getSentMessages());
  });

  trapi.connect();
})();
