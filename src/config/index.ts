import type { Cluster } from '@solana/web3.js';
import { Token, PoolConfig } from '../types';

import { devnetPools, mainnetPools } from './pools';

import { tokens as devnetTokens } from './tokens.devnet';
import { tokens as mainnetTokens } from './tokens.mainnet';

export const tokens: Record<Cluster, Token[]> = {
  'devnet': devnetTokens,
  'mainnet-beta': mainnetTokens,
  'testnet': devnetTokens
}

export const pools: Record<Cluster, PoolConfig[]> = {
  'devnet': devnetPools,
  'mainnet-beta': mainnetPools,
  'testnet': devnetPools
}