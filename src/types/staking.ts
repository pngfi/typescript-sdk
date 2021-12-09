import { u64 } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

export type StakeConfigInfo = {
  tokenMint: PublicKey;
  sTokenMint: PublicKey;
  tokenHolder: PublicKey;
  rebaseEpochDuration: number;
  rebaseLastTime: number;
  rebaseRateNumerator: number;
  rebaseRateDenominator: number;
  rewardsHolder: PublicKey;
  rebaseSupply: u64;
}