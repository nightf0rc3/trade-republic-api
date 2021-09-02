import test from 'ava';

import { TradeRepublicApi } from './tradeRepublicApi';

test('message history is initially empty', (t) => {
  const trapi = new TradeRepublicApi();
  const response = trapi.getSentMessages();
  t.is(response.size, 0);
});
