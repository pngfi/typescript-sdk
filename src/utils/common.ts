import type { Cluster } from '@solana/web3.js';

import { PublicKey } from '@solana/web3.js';

import { PoolInfo, Token } from '../types';
import Decimal from 'decimal.js';
import { u64 } from '@solana/spl-token';

export const ZERO_U64 = new u64(0);
export const ONE_U64 = new u64(1);
export const ONE_HUNDRED_U64 = new u64(100);
export const ONE_THOUSAND_U64 = new u64(1000);

export function isNumber(value: any) {
  const reg = /^[0-9]+\.?[0-9]*$/;
  return reg.test(value);
}

export function beautify(str = ''): string {
  const reg = str.indexOf('.') > -1 ? /(\d)(?=(\d{3})+\.)/g : /(\d)(?=(?:\d{3})+$)/g;
  str = str.replace(reg, '$1,');
  return str.replace(/(\.[0-9]+[1-9]+)(0)*/, '$1');
}

export function toFixed(value = 0, fixed = 2, force = false): string {
  const str = /\./.test(value.toString()) ? new Decimal(value).toFixed(fixed, 1) :
    new Decimal(value).toFixed(force ? fixed : 0, 1);
    
  return str.replace(/(\.[0-9]+[1-9]+)(0)*/, '$1');
}

export function getTokenByMint(mint: string, tokens: Token[]): Token | undefined {
  return tokens.find(t => t.mint === mint);
}

export function getTokenBySymbol(symbol: string, tokens: Token[]): Token | undefined {
  return tokens.find(t => t.symbol === symbol);
}

export function toShortAddr(pubkey: string | PublicKey, length = 4): string {
  if (typeof pubkey !== 'string') {
    pubkey = pubkey.toString();
  }
  return `${pubkey.substr(0, length)}...${pubkey.substr(-length)}`;
}

export const getPairByPoolInfo = (info: PoolInfo): string => {
  const pair = info.tokenA.symbol + '_' + info.tokenB.symbol;
  return pair;
}