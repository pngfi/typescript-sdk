import { PublicKey } from '@solana/web3.js';
import { StakingConfig } from '../types';

export const mainnetStakings: StakingConfig[] = [
];

export const devnetStakings: StakingConfig[] = [
  {
    address: new PublicKey('EFes66miKQkoSHsYwFBiKTaSKvX9Cd8CQgCSqLrZf38'),
    vestConfig: new PublicKey('HbrVWaVLb98ozeSiC69tt9T7TXYB8j2qyCke6qqEMC97'),
    payoutAsset: new PublicKey('PNGXZxRnRwixr7jrMSctAErSTF5SRnPQcuakkWRHe4h')
  }
];