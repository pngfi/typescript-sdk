import { PublicKey } from '@solana/web3.js';

import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  {
    addr: new PublicKey('7L6ys1rpyyBmYGk7iUjTxdXUQSkR8tbC92c5sNqMA8fP'),
    vestConfig: new PublicKey('7tJr8aPhtuKtWhijHLaDmMLp2ddDZfqpKeUd39MymfE9')
  }
];