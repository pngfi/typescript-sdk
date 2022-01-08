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
  // {
  //   address: new PublicKey('GywyKSMqcQSaz1rq9pLLV5XS7EizhujqSgbjMbKKb2Gr'),
  //   staking: new PublicKey('588SLHWjju9Z7YyNdksofW2fUrD9TbdFz5wb7eycCRBR'),
  //   vestConfig: new PublicKey('FQ1JSZykSm5cLbsGXEJg6BM7y48Pr41z1PHR7vneox72'),
  //   payoutAsset: new PublicKey('PNGmGQ7SwKTHHPCRgnznYbyTPkrAxcAPLqpgNDYNP1g'),
  // },
  {
    address: new PublicKey('DsXsprxo2qZMu6UJMwv3F9PBcVtG68AJh5tuAWL2sDD3'),
    staking: new PublicKey('9RsQSNgi5GDDBC22y7KZXNdQv19fMDR3c5LigCm3gjRy'),
    vestConfig: new PublicKey('74geuqwioFsijC8j1UbrVdtr21Q5etd3Qi73ciQQ1r4e'),
    payoutAsset: new PublicKey('BUDkmty8HggNkNvVfRAUJXvSuW4kar9ZtPUG5grNttQ4'),
  },
];