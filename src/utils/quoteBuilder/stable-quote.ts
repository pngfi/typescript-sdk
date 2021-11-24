import { u64 } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { computeBaseOutputAmount, computeOutputAmount } from '@orca-so/stablecurve';
import { DecimalUtil, ZERO_U64, ONE_THOUSAND_U64 } from '../../utils';
import { Quote, QuotePoolParams } from '../../types';
import { SOL_TOKEN_MINT } from '../../utils';

function getInputAmountLessFees(inputTradeAmount: u64, params: QuotePoolParams): u64 {
  return inputTradeAmount.sub(getLPFees(inputTradeAmount, params));
}

function getOutputAmountWithNoSlippage(
  inputTradeAmountLessFees: u64,
  params: QuotePoolParams
): u64 {
  const [poolInputAmount, poolOutputAmount, amp] = [
    params.inputTokenCount,
    params.outputTokenCount,
    params.amp!,
  ];

  return computeBaseOutputAmount(inputTradeAmountLessFees, poolInputAmount, poolOutputAmount, amp);
}

function getOutputAmount(inputTradeAmountLessFees: u64, params: QuotePoolParams): u64 {
  const [poolInputAmount, poolOutputAmount, amp] = [
    params.inputTokenCount,
    params.outputTokenCount,
    params.amp!,
  ];

  return computeOutputAmount(inputTradeAmountLessFees, poolInputAmount, poolOutputAmount, amp);
}

function getExpectedOutputAmountWithNoSlippage(
  inputTradeAmount: u64,
  params: QuotePoolParams
): u64 {
  const inputTradeAmountLessFees = getInputAmountLessFees(inputTradeAmount, params);

  return getOutputAmountWithNoSlippage(inputTradeAmountLessFees, params);
}

function getExpectedOutputAmount(inputTradeAmount: u64, params: QuotePoolParams): u64 {
  const inputTradeAmountLessFees = getInputAmountLessFees(inputTradeAmount, params);

  return getOutputAmount(inputTradeAmountLessFees, params);
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
  if (
    inputTradeAmount.eq(ZERO_U64) ||
    params.inputTokenCount.eq(ZERO_U64) ||
    params.outputTokenCount.eq(ZERO_U64)
  ) {
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

  const tradingFee =
    feeStructure.tradeFeeNumerator === 0
      ? ZERO_U64
      : inputTradeAmount
          .mul(new u64(feeStructure.tradeFeeNumerator))
          .div(new u64(feeStructure.tradeFeeDenominator));

  const ownerFee =
    feeStructure.tradeFeeNumerator === 0
      ? ZERO_U64
      : inputTradeAmount
          .mul(new u64(feeStructure.tradeFeeNumerator))
          .div(new u64(feeStructure.tradeFeeDenominator));

  return new u64(tradingFee.add(ownerFee).toString());
}

function getMinimumAmountOut(inputTradeAmount: u64, params: QuotePoolParams): u64 {
  const expectedOutputAmount = getExpectedOutputAmount(inputTradeAmount, params);

  return expectedOutputAmount
    .mul(ONE_THOUSAND_U64.sub(new u64(params.slippage)))
    .div(ONE_THOUSAND_U64);
}

function getNetworkFees(params: QuotePoolParams): number {
  let numSigs;

  if (new PublicKey(params.inputToken.mint).equals(SOL_TOKEN_MINT) || 
    new PublicKey(params.outputToken.mint).equals(SOL_TOKEN_MINT)) {
    numSigs = 3;
  } else {
    numSigs = 2;
  }

  return params.lamportsPerSignature * numSigs;
}

export class StablePoolQuoteBuilder {
  buildQuote(params: QuotePoolParams, inputTradeAmount: u64): Quote {
    if (!params.amp) {
      throw new Error("amp param required for stable pool");
    }

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