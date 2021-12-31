import { PublicKey } from '@solana/web3.js';
import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  // {
  //   address: new PublicKey('dCN5mwZbDeWCHfp9NF7tv9VVHPmjPSKLpUnKc4WC8bJ'),
  //   staking: new PublicKey('EFes66miKQkoSHsYwFBiKTaSKvX9Cd8CQgCSqLrZf38'),
  //   payoutAsset: new PublicKey('PNGXZxRnRwixr7jrMSctAErSTF5SRnPQcuakkWRHe4h')
  // }
  {
    address: new PublicKey('B28zE2Ng74EKJTbsDLEgLJ268JoYD4pri2qEfgumfRXg'),
    staking: new PublicKey('3sHcGhf9YN9DTRvHM33s7T4ZvqtSTAn1mLASHyg4mufs'),
    payoutAsset: new PublicKey('PNGmGQ7SwKTHHPCRgnznYbyTPkrAxcAPLqpgNDYNP1g'),
    vestConfig: new PublicKey('B4nJVtNgqZAjWMy5Twy1JbXYgsX5K4LjKvUaZT6SrvCm'),
  }
];