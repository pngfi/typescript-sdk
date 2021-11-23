import { u64 } from '@solana/spl-token';
import Decimal from 'decimal.js';

import { Token, FeeStructure } from '.';

export type QuotePoolParams = {
  inputToken: Token;
  outputToken: Token;
  feeStructure: FeeStructure;
  slippage: number;
  lamportsPerSignature: number;
  amp?: u64;
};

export type Quote = {
  /**
   * Returns the rate of exchange given the trade amount. Fees are included.
   * Rate is zero if the input trade amount, input or output token balance in pool is zero.
   * @returns a function that returns the rate of exchange when the quote was built (denominated by output token)
   */
  getRate: () => Decimal;

  /**
   * Returns the fee that will be charged in this exchange.
   * @return a function that returns the fee (denominated by input token) that will be charged in this exchange.
   */
  getLPFees: () => u64;

  /**
   * Return the network fee that will be charged to submit the transaction.
   * @return a function that returns the network fee in lamports that will be charged to submit the transaction.
   */
  getNetworkFees: () => u64;

  /**
   * Returns the % impact to the rate if this transaction goes through.
   * @return a function to return the % impact to the rate if this transaction goes through. Zero if input or output token balance in pool is zero.
   */
  getPriceImpact: () => Decimal;

  /**
   * Returns the expected amount of output tokens returned if this exchange is transacted. Fees applied.
   * @return a function to return the expected amount of output tokens returned if this exchange is transacted
   */
  getExpectedOutputAmount: () => u64;

  /**
   * Returns the minimum amount of output tokens returned if this exchange is transacted. Fees & maximum slippage applied.
   * @return a function to return the minimum amount of output tokens returned if this exchange is transacted
   */
  getMinOutputAmount: () => u64;
};

export type DepositQuote = {
  minPoolTokenAmountOut: u64;
  maxTokenAIn: u64;
  maxTokenBIn: u64;
};

export type WithdrawQuote = {
  maxPoolTokenAmountIn: u64;
  minTokenAOut: u64;
  minTokenBOut: u64;
}