import { PublicKey } from '@solana/web3.js';
import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  {
    address: new PublicKey('dCN5mwZbDeWCHfp9NF7tv9VVHPmjPSKLpUnKc4WC8bJ'),
    staking: new PublicKey('EFes66miKQkoSHsYwFBiKTaSKvX9Cd8CQgCSqLrZf38'),
    payoutAsset: new PublicKey('PNGXZxRnRwixr7jrMSctAErSTF5SRnPQcuakkWRHe4h'),
    vestConfig: new PublicKey('HbrVWaVLb98ozeSiC69tt9T7TXYB8j2qyCke6qqEMC97'),
  }
];