import { PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';

export type LPInfo = {
  tokenAHolder: PublicKey;
  tokenBHolder: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
}

export type BondingConfig = {
  addr: PublicKey;
  vestConfig: PublicKey;
}

export type BondingInfo = {
  address: PublicKey;
  assetMint: PublicKey;
  assetHolder: PublicKey;
  assetHolderAmount: Decimal;
  vTokenHolder: PublicKey;
  lpInfo: LPInfo;
}