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
    address: new PublicKey('6YTSDJNzhTn4agLV26demFHDRCUWtBxNrnpti7XhaMJE'),
    staking: new PublicKey('J3wqkYG1qq46S8WJ6pf8FaV5f7dZdAXviSftAUgDRD26'),
    vestConfig: new PublicKey('74geuqwioFsijC8j1UbrVdtr21Q5etd3Qi73ciQQ1r4e'),
    payoutAsset: new PublicKey('BUDkmty8HggNkNvVfRAUJXvSuW4kar9ZtPUG5grNttQ4'),
  },
];