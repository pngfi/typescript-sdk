import { u64 } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

export type LPInfo = {
  tokenAHolder: PublicKey;
  tokenBHolder: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
}

export type PayoutInfo = {
  payoutAmount: u64;
  internalPrice: u64;
}

// export type BondingConfig = {
//   address: PublicKey;
//   payoutAsset: PublicKey;
//   staking: PublicKey;
//   vestConfig: PublicKey;
// }
export type BondingConfig = {
  address: PublicKey;
}

export type BondingInfo = {
  pubkey: PublicKey;
  stakingPubkey: PublicKey;
  payoutHolder: PublicKey;
  bondingSupply: u64;
  depositHolder: PublicKey;
  depositHolderAmount: u64;
  depositTokenMint: PublicKey;
  // initDebt,
  maxDebt: u64;
  maxPayoutFactor: u64;
  minPrice: u64;
  payoutTokenMint: PublicKey;
  totalDebt: u64;
  controlVariable: number;
  decayFactor: number;
  lastDecay: number;
  vestConfigInfo: any
}

// export type BondingInfo = {
//   address: PublicKey;
//   payoutHolder: PublicKey;
//   payoutTokenMint: PublicKey;
//   depositHolder: PublicKey;
//   depositTokenMint: PublicKey;
//   depositHolderAmount: u64;
//   bondingSupply: u64;
//   maxPayoutFactor: u64,
//   initDebt: u64,
//   maxDebt: u64;
//   minPrice: u64;
//   totalDebt: u64;
//   controlVariable: number;
//   decayFactor: number;
//   lastDecay: number;
// }

export type VestConfigInfo = {
  vestMint: PublicKey;
  claimAllDuration: number;
  halfLifeDuration: number;
  claimableHolder: PublicKey;
  claimableMint: PublicKey;
}