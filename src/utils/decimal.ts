import { u64 } from '@solana/spl-token';
import Decimal from 'decimal.js';

import { beautify } from '../utils';

export const ZERO_DECIMAL = new Decimal(0);
export const ONE_DECIMAL = new Decimal(1);
export const ONE_HUNDRED_DECIMAL = new Decimal(100);

export class DecimalUtil {
  
  public static fromString(input: string, shift = 0): Decimal {
    return new Decimal(input||0).div(new Decimal(10).pow(shift));
  }

  public static fromNumber(input: number, shift = 0): Decimal {
    return new Decimal(input).div(new Decimal(10).pow(shift));
  }

  public static fromU64(input: u64, shift = 0): Decimal {
    return new Decimal(input.toString()).div(new Decimal(10).pow(shift));
  }

  public static toU64(input: Decimal, shift = 0): u64 {
    if (input.isNeg()) {
      throw new Error(`Negative decimal value ${input} cannot be converted to u64.`);
    }

    const shiftedValue = new u64(input.mul(new Decimal(10).pow(new Decimal(shift))).toDecimalPlaces(0).toString());
    return shiftedValue;
  }

  public static beautify(input: Decimal, fixed?: number): string {
   
    if (!fixed) {
      fixed = 
        input.eq(ZERO_DECIMAL) ? 2 :
        input.gt(ZERO_DECIMAL) && input.lt(ONE_DECIMAL) ? 6 : 
        input.gt(ONE_DECIMAL) && input.lt(ONE_HUNDRED_DECIMAL) ? 3 : 2;
    }

    const str = input.toFixed(fixed, 1);
    return beautify(str);
  }
}