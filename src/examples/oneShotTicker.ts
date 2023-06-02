import { TradeRepublicApi } from '..';
import { Ticker } from '../lib/tradeRepublicApi';

(() => {
  const trapi = new TradeRepublicApi({});

  trapi.on('connected', async () => {
    const data = await trapi.oneShot<Ticker>('ticker', {
      id: 'US90364P1057.LSX',
    });
    console.log(JSON.stringify(data));
    console.log(`Ask Price: ${data.payload.ask.price}`);
    trapi.disconnect();
  });

  trapi.connect();
})();
