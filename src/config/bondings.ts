import { PublicKey } from '@solana/web3.js';

import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  {
    addr: new PublicKey('9mpK5yExvU8D9q5GDg473Hp91MBUm3x3CfYUwyxnHNbG'),
    vestConfig: new PublicKey('BJyk9QTnhLyvRbTBcvNYTvw5wVxM9ybsXV4QVDkcVVmf')
  }
];