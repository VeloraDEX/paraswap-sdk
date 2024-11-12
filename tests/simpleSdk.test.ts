import * as dotenv from 'dotenv';
import Web3 from 'web3';
import { BigNumber as BigNumberEthers, ethers } from 'ethersV5';
import { ethers as ethersV6 } from 'ethers';
import axios from 'axios';
import fetch from 'isomorphic-unfetch';
import { isAllowance, SwapSide, SimpleFetchSDK } from '../src';
import BigNumber from 'bignumber.js';

import erc20abi from './abi/ERC20.json';

import { assert } from 'ts-essentials';

import { constructSimpleSDK, SimpleSDK } from '../src/sdk/simple';
import { HardhatProvider, setupFork } from './helpers/hardhat';

dotenv.config();

jest.setTimeout(30 * 1000);

const ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
// const HEX = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';

const DUMMY_ADDRESS_FOR_TESTING_ALLOWANCES =
  '0xb9A079479A7b0F4E7F398F7ED3946bE6d9a40E79';

const chainId = 1;
const srcToken = ETH;
const destToken = DAI;
const srcAmount = (1 * 1e18).toString(); //The source amount multiplied by its decimals

const referrer = 'sdk-test';
const TEST_MNEMONIC =
  'radar blur cabbage chef fix engine embark joy scheme fiction master release';
//0xaC39b311DCEb2A4b2f5d8461c1cdaF756F4F7Ae9
const wallet = ethers.Wallet.fromMnemonic(TEST_MNEMONIC);
const walletV6 = ethersV6.HDNodeWallet.fromPhrase(TEST_MNEMONIC);

const web3provider = new Web3(HardhatProvider as any);

const ethersProvider = new ethers.providers.Web3Provider(
  HardhatProvider as any
);
const ethersV6Provider = new ethersV6.BrowserProvider(HardhatProvider);
const signerV6 = walletV6.connect(ethersV6Provider);

const signer = wallet.connect(ethersProvider);
const senderAddress = signer.address;

describe.each([
  ['fetch', { fetch }],
  ['axios', { axios }],
])('ParaSwap SDK: fetcher made with: %s', (testName, fetcherOptions) => {
  let paraSwap: SimpleFetchSDK;

  beforeAll(async () => {
    await setupFork({ accounts: [{ address: senderAddress, balance: 8e18 }] });

    paraSwap = constructSimpleSDK({ chainId, ...fetcherOptions, version: '5' });
  });
  test('getBalance', async () => {
    try {
      const balance = await paraSwap.swap.getBalance(senderAddress, ETH);
      expect(balance).toBeDefined();
    } catch (error: any) {
      // workaround for API sometimes failing on some Tokens(?)
      expect(error.message).toMatch(/Only chainId \d+ is supported/);
    }
  });

  test('Get_Markets', async () => {
    const markets = await paraSwap.swap.getAdapters();
    expect(markets.length).toBeGreaterThan(15);
  });

  test('Get_Tokens', async () => {
    const tokens = await paraSwap.swap.getTokens();

    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]).toEqual(
      expect.objectContaining({
        symbol: expect.any(String),
        address: expect.any(String),
        decimals: expect.any(Number),
      })
    );
  });

  test('Get_Rates', async () => {
    const priceRoute = await paraSwap.swap.getRate({
      srcToken: ETH,
      destToken: DAI,
      amount: srcAmount,
      userAddress: senderAddress,
      side: SwapSide.SELL,
      options: {
        includeDEXS: ['UniswapV2'],
        otherExchangePrices: true,
      },
    });

    const { destAmount, bestRoute, others } = priceRoute;

    expect(typeof destAmount).toBe('string');

    expect(Array.isArray(bestRoute)).toBe(true);

    const swapExchange = bestRoute[0]?.swaps[0]?.swapExchanges[0];

    assert(swapExchange, 'exchange available at swapExchanges[0]');

    expect(typeof swapExchange.destAmount).toBe('string');
    expect(new BigNumber(swapExchange.destAmount).isNaN()).toBe(false);

    expect(typeof swapExchange.exchange).toBe('string');

    const firstBestRoute = bestRoute[0];
    assert(firstBestRoute, 'route available at bestRoute[0]');

    expect(typeof firstBestRoute.percent).toBe('number');
    expect(new BigNumber(firstBestRoute.percent).isNaN()).toBe(false);

    expect(typeof swapExchange.srcAmount).toBe('string');
    expect(new BigNumber(swapExchange.srcAmount).isNaN()).toBe(false);

    expect(Array.isArray(others)).toBe(true);

    const firstRoute = others?.[0];

    assert(firstRoute, 'at least one route must exist');

    expect(typeof firstRoute.exchange).toBe('string');

    expect(typeof firstRoute.unit).toBe('string');
    expect(firstRoute.unit && new BigNumber(firstRoute.unit).isNaN()).toBe(
      false
    );
  });

  test('Get_SwapTxData', async () => {
    const { priceRoute, txParams } = await paraSwap.swap.getSwapTxData({
      srcToken: ETH,
      destToken: DAI,
      amount: srcAmount,
      userAddress: senderAddress,
      side: SwapSide.SELL,
      slippage: 500,
      options: {
        includeDEXS: ['UniswapV2'],
      },
    });

    const bestRouteStable = priceRoute.bestRoute.map((b) => ({
      ...b,
      swaps: b.swaps.map((s) => ({
        ...s,
        swapExchanges: s.swapExchanges.map((se) => ({
          ...se,
          destAmount: 'dynamic_number',
          data: {
            ...se.data,
            gasUSD: 'dynamic_number',
          },
        })),
      })),
    }));

    const priceRouteStable = {
      ...priceRoute,
      gasCost: 'dynamic_number',
      gasCostUSD: 'dynamic_number',
      hmac: 'dynamic_number',
      destAmount: 'dynamic_number',
      blockNumber: 'dynamic_number',
      srcUSD: 'dynamic_number',
      destUSD: 'dynamic_number',
      bestRoute: bestRouteStable,
    };

    const txParamsStable = {
      ...txParams,
      data: 'dynamic_string',
      from: 'dynamic_string',
      gasPrice: 'dynamic_number',
    };

    expect(txParams.from).toEqual(senderAddress);

    expect(priceRouteStable).toMatchSnapshot('Get_SwapTxData::priceRoute');
    expect(txParamsStable).toMatchSnapshot('Get_SwapTxData::txParams');
  });

  test('Get_Spender', async () => {
    const spender = await paraSwap.swap.getSpender();
    expect(web3provider.utils.isAddress(spender));
  });

  test('Get_Allowance', async () => {
    const allowance = await paraSwap.swap.getAllowance(
      DUMMY_ADDRESS_FOR_TESTING_ALLOWANCES,
      DAI
    );

    assert(isAllowance(allowance), 'hardcoded dummy address should be found');

    expect(allowance.allowance).toEqual('123000000000000000');
  });

  test('Get_Adapters', async () => {
    const adapters = await paraSwap.swap.getAdapters();
    expect(adapters).toMatchSnapshot('Get_Adapters');
  });

  test('Build_Tx', async () => {
    const destToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const priceRoute = await paraSwap.swap.getRate({
      srcToken,
      destToken,
      amount: srcAmount,
      userAddress: senderAddress,
      side: SwapSide.SELL,
      options: {
        includeDEXS: ['UniswapV2'],
      },
    });

    const destAmount = new BigNumber(priceRoute.destAmount)
      .times(0.99)
      .toFixed(0);

    const txParams = await paraSwap.swap.buildTx(
      {
        srcToken,
        destToken,
        srcAmount,
        destAmount,
        priceRoute,
        userAddress: senderAddress,
        partner: referrer,
      },
      { ignoreChecks: true }
    );

    expect(typeof txParams).toBe('object');
  });
  test('Build_and_Send_Tx', async () => {
    const priceRoute = await paraSwap.swap.getRate({
      srcToken,
      destToken,
      amount: srcAmount,
      userAddress: senderAddress,
      side: SwapSide.SELL,
      options: {
        includeDEXS: ['Uniswap', 'UniswapV2', 'Balancer', 'Oasis'],
      },
    });

    const destAmount = new BigNumber(priceRoute.destAmount)
      .times(0.99)
      .toFixed(0);

    const txParams = await paraSwap.swap.buildTx(
      {
        srcToken,
        destToken,
        srcAmount,
        destAmount,
        priceRoute,
        userAddress: signer.address,
        partner: referrer,
      },
      { ignoreChecks: true }
    );

    const transaction = {
      ...txParams,
      gasPrice:
        txParams.gasPrice &&
        '0x' + new BigNumber(txParams.gasPrice).toString(16),
      maxFeePerGas:
        txParams.maxFeePerGas &&
        '0x' + new BigNumber(txParams.maxFeePerGas).toString(16),
      maxPriorityFeePerGas:
        txParams.maxPriorityFeePerGas &&
        '0x' + new BigNumber(txParams.maxPriorityFeePerGas).toString(16),
      gasLimit: '0x' + new BigNumber(5000000).toString(16),
      value: '0x' + new BigNumber(txParams.value).toString(16),
    };
    const toContract = new ethers.Contract(destToken, erc20abi, ethersProvider);
    const beforeFromBalance = await ethersProvider.getBalance(signer.address);
    const beforeToBalance = await toContract.balanceOf(signer.address);

    const txr = await signer.sendTransaction(transaction);
    await txr.wait(1);
    const afterFromBalance = await ethersProvider.getBalance(signer.address);
    const afterToBalance = await toContract.balanceOf(signer.address);
    expect(beforeFromBalance.gt(afterFromBalance)).toBeTruthy();
    expect(beforeToBalance.lt(afterToBalance)).toBeTruthy();
  });
  test('Build_and_Send_Tx_BUY', async () => {
    const destAmount = srcAmount;
    const priceRoute = await paraSwap.swap.getRate({
      srcToken,
      destToken,
      amount: destAmount,
      userAddress: senderAddress,
      side: SwapSide.BUY,
      options: { includeDEXS: ['Uniswap', 'UniswapV2', 'Balancer', 'Oasis'] },
    });
    const _srcAmount = new BigNumber(priceRoute.srcAmount)
      .times(1.1)
      .toFixed(0);

    const txParams = await paraSwap.swap.buildTx(
      {
        srcToken,
        destToken,
        srcAmount: _srcAmount,
        destAmount,
        priceRoute,
        userAddress: signer.address,
        partner: referrer,
      },
      { ignoreChecks: true }
    );

    const transaction = {
      ...txParams,
      gasPrice:
        txParams.gasPrice &&
        '0x' + new BigNumber(txParams.gasPrice).toString(16),
      maxFeePerGas:
        txParams.maxFeePerGas &&
        '0x' + new BigNumber(txParams.maxFeePerGas).toString(16),
      maxPriorityFeePerGas:
        txParams.maxPriorityFeePerGas &&
        '0x' + new BigNumber(txParams.maxPriorityFeePerGas).toString(16),
      gasLimit: '0x' + new BigNumber(5000000).toString(16),
      value: '0x' + new BigNumber(txParams.value).toString(16),
    };
    const toContract = new ethers.Contract(destToken, erc20abi, ethersProvider);
    const beforeFromBalance = await ethersProvider.getBalance(signer.address);
    const beforeToBalance = await toContract.balanceOf(signer.address);

    const txr = await signer.sendTransaction(transaction);
    await txr.wait(1);
    const afterFromBalance = await ethersProvider.getBalance(signer.address);
    const afterToBalance = await toContract.balanceOf(signer.address);
    expect(beforeFromBalance.gt(afterFromBalance)).toBeTruthy();
    expect(beforeToBalance.lt(afterToBalance)).toBeTruthy();
  });
});

describe.each([
  [
    'fetch & ethersV5',
    { fetch },
    {
      ethersProviderOrSigner: signer,
      EthersContract: ethers.Contract,
      account: senderAddress,
    },
  ],
  [
    'fetch & ethersV6',
    { fetch },
    {
      ethersV6ProviderOrSigner: signerV6,
      EthersV6Contract: ethersV6.Contract,
      account: senderAddress,
    },
  ],
  ['axios & web3', { axios }, { web3: web3provider, account: senderAddress }],
])(
  'ParaSwap SDK: contract calling methods: %s',
  (testName, fetcherOptions, providerOptions) => {
    let paraSwap: SimpleSDK;

    beforeAll(() => {
      paraSwap = constructSimpleSDK(
        { chainId, ...fetcherOptions, version: '5' },
        providerOptions
      );
    });
    test('approveToken', async () => {
      const txHash = await paraSwap.swap.approveToken('12345', DAI);

      await ethersProvider.waitForTransaction(txHash);

      const toContract = new ethers.Contract(
        destToken,
        erc20abi,
        ethersProvider
      );
      const spender = await paraSwap.swap.getSpender();
      const allowance: BigNumberEthers = await toContract.allowance(
        signer.address,
        spender
      );
      expect(allowance.toString()).toEqual('12345');
    });
  }
);
