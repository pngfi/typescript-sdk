import { u64 } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

export type StakingConfig = {
  address: PublicKey;
  vestConfig: PublicKey;
}

export type StakingInfo = {
  pubkey: PublicKey;
  tokenMint: PublicKey;
  sTokenMint: PublicKey;
  tokenHolder: PublicKey;
  payoutTokenMint: PublicKey;   //TODO
  tokenHolderAmount: u64;
  rebaseEpochDuration: number,
  rebaseLastTime: number,
  rebaseRateNumerator: number,
  rebaseRateDenominator: number,
  rewardsHolder: PublicKey,
  apy: number,
  rewardsPerDay: string,
  rebaseSupply: u64,
  sTokenMintSupply: u64,
  rebaseRewardsAmount: u64,
  vestConfigInfo: {
    pubkey: PublicKey,
    vestMint: PublicKey;
    claimAllDuration: number;
    halfLifeDuration: number;
    claimableHolder: PublicKey;
    claimableMint: PublicKey;
  }
}

export type UserVestingInfo = {
  pubkey: PublicKey,
  claimableAmount: u64,
  lastUpdatedTime: u64,
  lastVestTime: u64,
  // nonce
  owner: PublicKey,
  vestConfig: PublicKey,
  vestedHolder: PublicKey,
  vestedHolderAmount: u64,
}
