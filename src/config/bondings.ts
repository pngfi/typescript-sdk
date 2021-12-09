import { PublicKey } from '@solana/web3.js';

import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  {
    addr: new PublicKey('6CnPA2KAjaexpbXfPveJiCCbzCgiagLMDJdo2Hn5ZDu'),
    vestConfig: new PublicKey('7tJr8aPhtuKtWhijHLaDmMLp2ddDZfqpKeUd39MymfE9')
  }
];