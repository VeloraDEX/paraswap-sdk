# ParaSwap SDK

<img src="https://paraswap-achirecture.netlify.com/logo.png" width="400px" >

---

### API docs are available here :

https://developers.paraswap.network

### To use ParaSwap SDK :

Install the lib using npm or yarn

```bash
yarn add paraswap
```

##### Then on a Javascript file:

```javascript
const { ParaSwap } = require('paraswap');
const paraSwap = new ParaSwap();
```

ES6 or TypeScript

```typescript
import { ParaSwap } from 'paraswap';
const paraSwap = new ParaSwap();
```

##### To retrieve the list all available tokens:

```javascript
const tokens = await paraSwap.getTokens();
```

##### To get the rate of a token pair using the API:

```javascript
const srcToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // ETH
const destToken = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'; // DAI
const srcAmount = '1000000000000000000'; //The source amount multiplied by its decimals: 10 ** 18 here

const priceRoute: OptimalRates = await paraSwap.getRate(
  srcToken,
  destToken,
  srcAmount,
);
```

Where priceRoute contains the rate and the distribution among exchanges, checkout the OptimalRates type for more details.

##### To get the rate of a token pair using the Price Feed Contract:

This can be used for trustless integrations, the

```javascript
const paraswap = new ParaSwap(1);
const priceRoute: OptimalRates = await paraswap.getRate(
  srcToken,
  destToken,
  srcAmount,
);
```

This is a schema that describes the data flow from price query to executing a Swap:

<img src="https://paraswap-achirecture.netlify.com/ParaSwapDeveloper.png" width="400px" >

Also available at https://paraswap-achirecture.netlify.com

##### To get the allowance of an ERC20

```javascript
const paraSwap = new ParaSwap().setWeb3Provider(web3Provider);

const allowance = await paraSwap.getAllowance(userAddress, tokenAddress);
```

##### To approve an ERC20

```javascript
const paraSwap = new ParaSwap().setWeb3Provider(web3Provider);

const txHash = await paraSwap.approveToken(amount, userAddress, tokenAddress);
```

##### To build and sign a transaction

```javascript
const srcToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const destToken = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';
const srcAmount = '1000000000000000000'; //The source amount multiplied by its decimals
const senderAddress = '0xfceA770875E7e6f25E33CEa5188d12Ef234606b4';
const receiver = '0x8B4e846c90a2521F0D2733EaCb56760209EAd51A'; // Useful in case of swap and transfer
const referrer = 'my-company-or-nick-name';

const txParams = await paraSwap.buildTx(
  srcToken,
  destToken,
  srcAmount,
  destAmount,
  priceRoute,
  senderAddress,
  referrer,
  receiver,
);

web3.eth.sendTransaction(
  txParams,
  async (err: Error, transactionHash: string) => {
    if (err) {
      return this.setState({ error: err.toString(), loading: false });
    }
    console.log('transactionHash', transactionHash);
  },
);
```

---

### To run the example locally:

Created an .env file with these 2 env variables:

```bash
PROVIDER_URL=YOUR_PROVIDRER_URL_OR_INFURA_URL
NODE_ENV=production
```

run

```bash
yarn install paraswap
```

For local developement you can run

```bash
yarn dev
```

For production build:

```bash
yarn build
```

Which will generate a production build on "dist" folder
