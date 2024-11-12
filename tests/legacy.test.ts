import * as dotenv from 'dotenv';
import Web3 from 'web3';
import { ethers } from 'ethersV5';
import fetch from 'isomorphic-unfetch';
import {
  ParaSwap,
  Token,
  Allowance,
  TransactionParams,
  SwapSide,
  OptimalRate,
} from '../src';
import BigNumber from 'bignumber.js';
import { APIError } from '../src/legacy';
import erc20abi from './abi/ERC20.json';

import { assert } from 'ts-essentials';
import { HardhatProvider, setupFork } from './helpers/hardhat';

dotenv.config();

jest.setTimeout(30 * 1000);

const ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const BAT = '0x0d8775f648430679a709e98d2b0cb6250d2887ef';
const MANA = '0x0f5d2fb29fb7d3cfee444a200298f468908cc942';
const chainId = 1;
const srcToken = ETH;
const destToken = DAI;
const srcAmount = (1 * 1e18).toString(); //The source amount multiplied by its decimals

const referrer = 'sdk-test';

const wallet = ethers.Wallet.createRandom();

const web3Provider = new Web3(HardhatProvider as any);

const ethersProvider = new ethers.providers.Web3Provider(
  HardhatProvider as any
);

const signer = wallet.connect(ethersProvider);
const senderAddress = signer.address;

describe('ParaSwap SDK', () => {
  let paraSwap: ParaSwap;

  beforeAll(async () => {
    await setupFork({
      accounts: [{ address: senderAddress, balance: 8e18 }],
    });
    paraSwap = new ParaSwap({ chainId, fetch, version: '5' }).setWeb3Provider(
      web3Provider
    );
  });

  test('Get_Balance', async () => {
    const balance = await paraSwap.getBalance(senderAddress, ETH);
    expect(balance).toBeDefined();
  });

  test('Get_Markets', async () => {
    const markets = await paraSwap.getMarketNames();
    expect((markets as string[]).length).toBeGreaterThan(15);
  });

  test('Get_Tokens', async () => {
    const tokensOrError = await paraSwap.getTokens();

    const tokens = tokensOrError as Token[];

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
    const ratesOrError = await paraSwap.getRate(
      'ETH',
      'DAI',
      srcAmount,
      senderAddress,
      SwapSide.SELL,
      { includeDEXS: ['UniswapV2'], otherExchangePrices: true }
    );
    const priceRoute = ratesOrError as OptimalRate;

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
    expect(new BigNumber(firstRoute.unit as string).isNaN()).toBe(false);
  });

  test('Get_Spender', async () => {
    const spender = await paraSwap.getTokenTransferProxy();
    expect(web3Provider.utils.isAddress(spender as string));
  });

  test('Get_Allowance', async () => {
    const allowance = await paraSwap.getAllowance(senderAddress, DAI);

    if (!allowance || (allowance as APIError).message) {
      return;
    }

    expect(new BigNumber((allowance as Allowance).allowance).isNaN()).toBe(
      false
    );
  });

  test('Get_Allowances', async () => {
    const allowancesOrError = await paraSwap.getAllowances(senderAddress, [
      DAI,
      BAT,
      MANA,
    ]);

    if ('message' in allowancesOrError) {
      return;
    }

    const allowances = allowancesOrError;

    allowances.forEach((allowance) =>
      expect(new BigNumber(allowance.allowance).isNaN()).toBe(false)
    );
  });

  test('Get_Adapters', async () => {
    const adaptersOrError = await paraSwap.getAdapters();

    const adapters = adaptersOrError as string[];

    expect(adapters).toMatchSnapshot('Get_Adapters');
  });

  test('Build_Tx', async () => {
    const destToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const ratesOrError = await paraSwap.getRate(
      srcToken,
      destToken,
      srcAmount,
      senderAddress,
      SwapSide.SELL,
      { includeDEXS: ['UniswapV2'] }
    );

    expect((ratesOrError as APIError)?.data?.error).toBeUndefined();

    const priceRoute = ratesOrError as OptimalRate;

    const destAmount = new BigNumber(priceRoute.destAmount)
      .times(0.99)
      .toFixed(0);

    const txOrError = await paraSwap.buildTx(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      priceRoute,
      senderAddress,
      referrer,
      undefined,
      undefined,
      undefined,
      { ignoreChecks: true }
    );

    expect(txOrError.data.error).toBeUndefined();
    expect(typeof txOrError).toBe('object');
  });

  test('Build_and_Send_Tx_SELL', async () => {
    const ratesOrError = await paraSwap.getRate(
      srcToken,
      destToken,
      srcAmount,
      senderAddress,
      SwapSide.SELL,
      { includeDEXS: ['Uniswap', 'UniswapV2', 'Balancer', 'Oasis'] }
    );
    const priceRoute = ratesOrError as OptimalRate;
    const destAmount = new BigNumber(priceRoute.destAmount)
      .times(0.99)
      .toFixed(0);

    const txOrError = await paraSwap.buildTx(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      priceRoute,
      signer.address,
      referrer,
      undefined,
      undefined,
      undefined,
      { ignoreChecks: true }
    );
    const _tx = txOrError as TransactionParams;
    const transaction = {
      ..._tx,
      gasPrice: _tx.gasPrice && '0x' + new BigNumber(_tx.gasPrice).toString(16),
      maxFeePerGas:
        _tx.maxFeePerGas && '0x' + new BigNumber(_tx.maxFeePerGas).toString(16),
      maxPriorityFeePerGas:
        _tx.maxPriorityFeePerGas &&
        '0x' + new BigNumber(_tx.maxPriorityFeePerGas).toString(16),
      gasLimit: '0x' + new BigNumber(5000000).toString(16),
      value: '0x' + new BigNumber(_tx.value).toString(16),
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
    const ratesOrError = await paraSwap.getRate(
      srcToken,
      destToken,
      destAmount,
      senderAddress,
      SwapSide.BUY,
      { includeDEXS: ['Uniswap', 'UniswapV2', 'Balancer', 'Oasis'] }
    );
    const priceRoute = ratesOrError as OptimalRate;
    const _srcAmount = new BigNumber(priceRoute.srcAmount)
      .times(1.1)
      .toFixed(0);

    const txOrError = await paraSwap.buildTx(
      srcToken,
      destToken,
      _srcAmount,
      destAmount,
      priceRoute,
      signer.address,
      referrer,
      undefined,
      undefined,
      undefined,
      { ignoreChecks: true }
    );
    const _tx = txOrError as TransactionParams;
    const transaction = {
      ..._tx,
      gasPrice: _tx.gasPrice && '0x' + new BigNumber(_tx.gasPrice).toString(16),
      maxFeePerGas:
        _tx.maxFeePerGas && '0x' + new BigNumber(_tx.maxFeePerGas).toString(16),
      maxPriorityFeePerGas:
        _tx.maxPriorityFeePerGas &&
        '0x' + new BigNumber(_tx.maxPriorityFeePerGas).toString(16),
      gasLimit: '0x' + new BigNumber(5000000).toString(16),
      value: '0x' + new BigNumber(_tx.value).toString(16),
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
