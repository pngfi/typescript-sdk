import { PublicKey } from '@solana/web3.js';

import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  {
    addr: new PublicKey('6iyQEv8eRkH88wrDwfqZ1XDakqfS7zBvwFuYH8F3s3s9')
  }
];