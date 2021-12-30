import { PublicKey } from '@solana/web3.js';
import { StakingConfig } from '../types';

export const mainnetStakings: StakingConfig[] = [
];

export const devnetStakings: StakingConfig[] = [
  {
    address: new PublicKey('3sHcGhf9YN9DTRvHM33s7T4ZvqtSTAn1mLASHyg4mufs'),
    vestConfig: new PublicKey('B4nJVtNgqZAjWMy5Twy1JbXYgsX5K4LjKvUaZT6SrvCm'),
    payoutAsset: new PublicKey('PNGmGQ7SwKTHHPCRgnznYbyTPkrAxcAPLqpgNDYNP1g')
  }
];