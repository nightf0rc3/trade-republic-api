# trade-republic-api

This package can be used to interact with Trade Republics API.

## Install dependencies

```bash
npm i trade-republic-api
```

## Usage

This example illustrates a subscription to the `ticker` topic for the ISIN US90364P1057.
For more please check the examples folder.

```javascript
const trapi = new TradeRepublicApi({});

trapi.on('connected', async () => {
  const data =
    (await trapi.oneShot) <
    Ticker >
    ('ticker',
    {
      id: 'US90364P1057.LSX',
    });
  console.log(JSON.stringify(data));
  console.log(`Ask Price: ${data.payload.ask.price}`);
});

trapi.connect();
```
