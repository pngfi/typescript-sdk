import { PublicKey } from '@solana/web3.js';
import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
];

export const devnetBondings: BondingConfig[] = [
  {
    address: new PublicKey('dCN5mwZbDeWCHfp9NF7tv9VVHPmjPSKLpUnKc4WC8bJ'),
    staking: new PublicKey('21pA3fSU523rGbJxRdWbTR4yLxPk8QBenUo9facXM3xY'),
    payoutAsset: new PublicKey('PNGXZxRnRwixr7jrMSctAErSTF5SRnPQcuakkWRHe4h')
  }
];