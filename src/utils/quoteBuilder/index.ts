import { u64 } from '@solana/spl-token';
import { QuotePoolParams, Quote } from '../../types';
import { CurveType } from '../';

import { ConstantPricePoolQuoteBuilder, ConstantProductPoolQuoteBuilder } from './constant-product-quote';
import { StablePoolQuoteBuilder } from './stable-quote';

export interface QuoteBuilder {
  buildQuote(pool: QuotePoolParams, inputAmount: u64): Quote;
}

export class QuoteBuilderFactory {
  static getBuilder(curveType: CurveType): QuoteBuilder | undefined {
    switch (curveType) {
      case CurveType.ConstantProduct:
        return new ConstantProductPoolQuoteBuilder();
      case CurveType.ConstantPrice:
        return new ConstantPricePoolQuoteBuilder();
      case CurveType.Stable:
        return new StablePoolQuoteBuilder();
      default:
        return undefined;
    }
  }
}