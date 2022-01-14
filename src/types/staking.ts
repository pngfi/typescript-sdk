import { u64 } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

export type StakingConfig = {
  address: PublicKey;
  vestConfig: PublicKey;
  payoutAsset: PublicKey;
}

export type StakingInfo = {
  tokenMint: PublicKey;
  sTokenMint: PublicKey;
  tokenHolder: PublicKey;
  payoutTokenMint: PublicKey;
  tokenHolderAmount: u64;
  rebaseEpochDuration: number;
  rebaseLastTime: number;
  rebaseRateNumerator: number;
  rebaseRateDenominator: number;
  rewardsHolder: PublicKey;
  rebaseSupply: u64;
  sTokenMintSupply: u64;
  rebaseRewardsAmount: u64;
}

export type UserVestingInfo = {
  lastUpdatedTime: u64,
  lastVestTime: u64,
  claimableAmount: u64,
  vestedHolderAmount: u64
}