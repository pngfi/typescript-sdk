import { PublicKey } from '@solana/web3.js';

import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  {
    addr: new PublicKey('Cxo28p6tkn5R1bTLdM7HHmLoyrfiG6WnLwMJLzMirpZo'),
    vestConfig: new PublicKey('7tJr8aPhtuKtWhijHLaDmMLp2ddDZfqpKeUd39MymfE9')
  }
];