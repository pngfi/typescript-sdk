import { u64 } from '@solana/spl-token';
import Decimal from 'decimal.js';
import { PublicKey } from '@solana/web3.js';
import { ZERO_U64, DecimalUtil, ONE_U64 } from '../';
import { QuotePoolParams, Quote } from '../../types';
import { ONE_THOUSAND_U64 } from '../common';
import { SOL_TOKEN_MINT } from '../constants';

/**
 * ConstantProductPools
 *
 * Product price curve:
 * x = inputTokenCount
 * y = outputTokenCount
 * k =  x * y
 */

 function ceilingDivision(dividend: u64, divisor: u64): [u64, u64] {
  let quotient = dividend.div(divisor);
  if (quotient.eq(ZERO_U64)) {
    return [ZERO_U64, divisor];
  }

  let remainder = dividend.mod(divisor);
  if (remainder.gt(ZERO_U64)) {
    quotient = quotient.add(ONE_U64);
    divisor = dividend.div(quotient);
    remainder = dividend.mod(quotient);
    if (remainder.gt(ZERO_U64)) {
      divisor = divisor.add(ONE_U64);
    }
  }

  return [quotient, divisor];
}

function getRate(inputTradeAmountU64: u64, params: QuotePoolParams): Decimal {
  if (inputTradeAmountU64.eq(ZERO_U64)) {
    return new Decimal(0);
  }

  const expectedOutputAmountU64 = getExpectedOutputAmount(inputTradeAmountU64, params);
  const inputTradeAmount = DecimalUtil.fromU64(inputTradeAmountU64, params.inputToken.decimals);
  const outputTradeAmount = DecimalUtil.fromU64(expectedOutputAmountU64, params.outputToken.decimals);
  return outputTradeAmount.div(inputTradeAmount).toDecimalPlaces(params.outputToken.decimals);
}

function getPriceImpact(inputTradeAmount: u64, params: QuotePoolParams): Decimal {
  if (inputTradeAmount.eq(ZERO_U64) || params.outputTokenCount.eq(ZERO_U64)) {
    return new Decimal(0);
  }

  const noSlippageOutputCountU64 = getExpectedOutputAmountWithNoSlippage(inputTradeAmount, params);
  const outputCountU64 = getExpectedOutputAmount(inputTradeAmount, params);

  const noSlippageOutputCount = DecimalUtil.fromU64(
    noSlippageOutputCountU64,
    params.outputToken.decimals
  );
  const outputCount = DecimalUtil.fromU64(outputCountU64, params.outputToken.decimals);

  const impact = noSlippageOutputCount.sub(outputCount).div(noSlippageOutputCount);
  return impact.mul(100).toDecimalPlaces(params.outputToken.decimals);
}

function getLPFees(inputTradeAmount: u64, params: QuotePoolParams): u64 {
  const { feeStructure } = params;
  const tradingFee = inputTradeAmount
    .mul(new u64(feeStructure.tradeFeeNumerator))
    .div(new u64(feeStructure.tradeFeeDenominator));

  // const ownerFee = 
  //   feeStructure.ownerTradeFee.numerator.gt(ZERO_U64) && 
  //   feeStructure.ownerTradeFee.denominator.gt(ZERO_U64) ?
  //   inputTradeAmount
  //   .mul(feeStructure.ownerTradeFee.numerator)
  //   .div(feeStructure.ownerTradeFee.denominator) : ZERO_U64;

  return new u64(tradingFee.toString());
}

function getExpectedOutputAmount(inputTradeAmount: u64, params: QuotePoolParams): u64 {
  const inputTradeLessFees = inputTradeAmount.sub(getLPFees(inputTradeAmount, params));
  return getOutputAmount(inputTradeLessFees, params);
}

function getExpectedOutputAmountWithNoSlippage(
  inputTradeAmount: u64,
  params: QuotePoolParams
): u64 {
  if (params.inputTokenCount.eq(ZERO_U64)) {
    return params.outputTokenCount;
  }

  const inputTradeLessFees = inputTradeAmount.sub(getLPFees(inputTradeAmount, params));
  return inputTradeLessFees.mul(params.outputTokenCount).div(params.inputTokenCount);
}

function getMinimumAmountOut(inputTradeAmount: u64, params: QuotePoolParams): u64 {
  const expectedOutputAmountFees = getExpectedOutputAmount(inputTradeAmount, params);
  const result = expectedOutputAmountFees
    .mul(ONE_THOUSAND_U64.sub(new u64(params.slippage)))
    .div(ONE_THOUSAND_U64);
  return result;
}

// Note: This function matches the calculation done on SERUM and on Web UI.
// Given k = currInputTokenCount * currOutputTokenCount and k = newInputTokenCount * newOutputTokenCount,
// solve for newOutputTokenCount
function getOutputAmount(inputTradeAmount: u64, params: QuotePoolParams): u64 {
  const [poolInputAmount, poolOutputAmount] = [params.inputTokenCount, params.outputTokenCount];

  const invariant = poolInputAmount.mul(poolOutputAmount);

  const [newPoolOutputAmount] = ceilingDivision(
    invariant,
    poolInputAmount.add(inputTradeAmount)
  );

  const outputAmount = poolOutputAmount.sub(newPoolOutputAmount);

  return new u64(outputAmount.toString());
}

function getNetworkFees(params: QuotePoolParams) {
  let numSigs;
  if (new PublicKey(params.inputToken.mint).equals(SOL_TOKEN_MINT) || 
    new PublicKey(params.outputToken.mint).equals(SOL_TOKEN_MINT)) {
    numSigs = 3;
  } else {
    numSigs = 2;
  }

  return params.lamportsPerSignature * numSigs;
}

export class ConstantProductPoolQuoteBuilder {
  buildQuote(params: QuotePoolParams, inputTradeAmount: u64): Quote {
    return {
      getRate: () => getRate(inputTradeAmount, params),
      getPriceImpact: () => getPriceImpact(inputTradeAmount, params),
      getLPFees: () => getLPFees(inputTradeAmount, params),
      getNetworkFees: () => new u64(getNetworkFees(params)),
      getExpectedOutputAmount: () => getExpectedOutputAmount(inputTradeAmount, params),
      getMinOutputAmount: () => getMinimumAmountOut(inputTradeAmount, params),
    };
  }
}