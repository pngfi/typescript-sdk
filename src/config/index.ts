import type { Cluster, PublicKey } from '@solana/web3.js';
import { Token, PoolConfig } from '../types';

import { devnetPools, mainnetPools } from './pools';
import { devnetBondings, mainnetBondings } from './bondings';

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

export const bondings: Record<Cluster, PublicKey[]> = {
  'devnet': devnetBondings,
  'mainnet-beta': mainnetBondings,
  'testnet': devnetBondings
}