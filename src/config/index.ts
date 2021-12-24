import type { Cluster } from '@solana/web3.js';
import { Token, PoolConfig, BondingConfig, StakingConfig } from '../types';

import { devnetPools, mainnetPools } from './pools';
import { devnetBondings, mainnetBondings } from './bondings';
import { devnetStakings, mainnetStakings } from './stakings';

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

export const bondings: Record<Cluster, BondingConfig[]> = {
  'devnet': devnetBondings,
  'mainnet-beta': mainnetBondings,
  'testnet': devnetBondings
}

export const stakings: Record<Cluster, StakingConfig[]> = {
  'devnet': devnetStakings,
  'mainnet-beta': mainnetStakings,
  'testnet': devnetStakings
}