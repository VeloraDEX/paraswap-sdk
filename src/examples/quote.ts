/* eslint-disable @typescript-eslint/no-unused-vars */
import axios from 'axios';
import { ethers, Wallet } from 'ethersV5';
import {
  constructPartialSDK,
  constructEthersContractCaller,
  constructAxiosFetcher,
  constructAllDeltaOrdersHandlers,
  constructGetQuote,
  constructSwapSDK,
  OptimalRate,
  DeltaPrice,
  isFetcherError,
} from '..';
import { startStatusCheck } from './helpers/delta';

const fetcher = constructAxiosFetcher(axios);

const provider = ethers.getDefaultProvider(1);
const signer = Wallet.createRandom().connect(provider);
const account = signer.address;
const contractCaller = constructEthersContractCaller({
  ethersProviderOrSigner: provider,
  EthersContract: ethers.Contract,
});

// type AdaptersFunctions & ApproveTokenFunctions<ethers.ContractTransaction>
const quoteSDK = constructPartialSDK(
  {
    chainId: 1,
    fetcher,
    contractCaller,
  },
  constructAllDeltaOrdersHandlers,
  constructSwapSDK,
  constructGetQuote
);

const DAI_TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDC_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

/**
 * mode='delta' example
 */
async function deltaQuote() {
  const amount = '1000000000000'; // wei

  const quote = await quoteSDK.getQuote({
    srcToken: DAI_TOKEN,
    destToken: USDC_TOKEN,
    amount,
    userAddress: account,
    srcDecimals: 18,
    destDecimals: 6,
    mode: 'delta',
    side: 'SELL',
    // partner: "..." // if available
  });

  try {
    const deltaPrice = quote.delta;
    await handleDeltaQuote({ amount, deltaPrice });
  } catch (error) {
    if (isFetcherError(error)) {
      const data = error.response?.data;
      console.log(`Delta Quote failed: ${data.errorType} - ${data.details}`);
    }
  }
}

/**
 * mode='market' example
 */
async function marketQuote() {
  const amount = '1000000000000'; // wei

  const quote = await quoteSDK.getQuote({
    srcToken: DAI_TOKEN,
    destToken: USDC_TOKEN,
    amount,
    userAddress: account,
    srcDecimals: 18,
    destDecimals: 6,
    mode: 'market',
    side: 'SELL',
    // partner: "..." // if available
  });

  const TokenTransferProxy = await quoteSDK.getSpender();

  // or sign a Permit1 or Permit2 TransferFrom for TokenTransferProxy
  const approveTxHash = quoteSDK.approveToken(amount, DAI_TOKEN);

  const txParams = await quoteSDK.buildTx({
    srcToken: DAI_TOKEN,
    destToken: USDC_TOKEN,
    srcAmount: amount,
    slippage: 250, // 2.5%
    priceRoute: quote.market,
    userAddress: account,
    // partner: '...' // if available
  });

  const swapTx = await handleMarketQuote({ amount, priceRoute: quote.market });
}

/**
 * mode='all' example
 */
async function allQuote() {
  const amount = '1000000000000'; // wei

  const quote = await quoteSDK.getQuote({
    srcToken: DAI_TOKEN,
    destToken: USDC_TOKEN,
    amount,
    userAddress: account,
    srcDecimals: 18,
    destDecimals: 6,
    mode: 'all',
    side: 'SELL',
    // partner: "..." // if available
  });

  if ('delta' in quote) {
    const deltaPrice = quote.delta;
    await handleDeltaQuote({ amount, deltaPrice });
  } else {
    console.log(
      `Delta Quote failed: ${quote.fallbackReason.errorType} - ${quote.fallbackReason.details}`
    );
    const swapTx = await handleMarketQuote({
      amount,
      priceRoute: quote.market,
    });
  }
}

async function handleDeltaQuote({
  amount,
  deltaPrice,
}: {
  amount: string;
  deltaPrice: DeltaPrice;
}) {
  /**
   * refer to examples/delta for more details
   */
  const DeltaContract = await quoteSDK.getDeltaContract();

  // or sign a Permit1 or Permit2 TransferFrom for DeltaContract
  await quoteSDK.approveTokenForDelta(amount, DAI_TOKEN);

  const slippagePercent = 0.5;
  const destAmountAfterSlippage = BigInt(
    // get rid of exponential notation

    +(+deltaPrice.destAmount * (1 - slippagePercent / 100)).toFixed(0)
    // get rid of decimals
  ).toString(10);

  const deltaAuction = await quoteSDK.submitDeltaOrder({
    deltaPrice,
    owner: account,
    // beneficiary: anotherAccount, // if need to send destToken to another account
    // permit: "0x1234...", // if signed a Permit1 or Permit2 TransferFrom for DeltaContract
    srcToken: DAI_TOKEN,
    destToken: USDC_TOKEN,
    srcAmount: amount,
    destAmount: destAmountAfterSlippage, // minimum acceptable destAmount
  });

  // poll if necessary
  startStatusCheck(() => quoteSDK.getDeltaOrderById(deltaAuction.id));

  return deltaAuction;
}

async function handleMarketQuote({
  amount,
  priceRoute,
}: {
  amount: string;
  priceRoute: OptimalRate;
}) {
  const TokenTransferProxy = await quoteSDK.getSpender();

  // or sign a Permit1 or Permit2 TransferFrom for TokenTransferProxy
  const approveTxHash = quoteSDK.approveToken(amount, DAI_TOKEN);

  const txParams = await quoteSDK.buildTx({
    srcToken: DAI_TOKEN,
    destToken: USDC_TOKEN,
    srcAmount: amount,
    slippage: 250, // 2.5%
    priceRoute,
    userAddress: account,
    // partner: '...' // if available
  });

  const swapTx = await signer.sendTransaction(txParams);
  return swapTx;
}
