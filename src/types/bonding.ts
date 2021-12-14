import { u64 } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';

export type LPInfo = {
  tokenAHolder: PublicKey;
  tokenBHolder: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
}

export type BondingInfo = {
  address: PublicKey;
  assetMint: PublicKey;
  assetMintDecimals: number;
  assetHolder: PublicKey;
  assetHolderAmount: Decimal;
  lpInfo: LPInfo;
  vestConfig: VestConfigInfo;
  lastDecay: number;
  decayFactor: number;
  controlVariable: number;
  totalDebt: u64;
  bondingSupply: u64;
}

export type VestConfigInfo = {
  vestMint: PublicKey;
  claimAllDuration: number;
  halfLifeDuration: number;
  claimableHolder: PublicKey;
  claimableMint: PublicKey;
}