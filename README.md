# trade-republic-api

This package can be used to interact with Trade Republics API (not officially supported, use at your own risk).

## Installation

```bash
npm i trade-republic-api
```

## Usage

This example illustrates a subscription to the `ticker` topic for the ISIN US90364P1057.
For more please check the examples folder.

```javascript
const trapi = new TradeRepublicApi({});

trapi.on('connected', async () => {
  const data = await trapi.oneShot<Ticker>('ticker', {
    id: 'US90364P1057.LSX',
  });
  console.log(JSON.stringify(data));
  console.log(`Ask Price: ${data.payload.ask.price}`);
});

trapi.connect();
```

Authentication is required for all topics related to your personal data. You can authenticate a session by using the `login` method with your phone number and pin. After the initial login, a 2-Factor-Authentication token (received in your app) has to be provided in the CLI in order to proceed.

```javascript
const trapi = new TradeRepublicApi({});

trapi.on('connected', async () => {
  await trapi.login('+1234567890123', '1234');
  const data = await trapi.oneShot<TimeLineResponse>('timeline');
  console.log(JSON.stringify(data));
});

trapi.connect();
```

## Supported and tested topics
- ticker
- timeline

Other topics might work as well, full list is available in `TradeRepublicMessageType` however you need find the correct message parameters yourself.