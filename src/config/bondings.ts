import { PublicKey } from '@solana/web3.js';
import { BondingConfig } from '../types';

export const mainnetBondings: BondingConfig[] = [
  {
    address: new PublicKey('6fDbbhGpWLSUVb75o7npL2G17JqdXhX1uRNBsH5xmnUM'),
    staking: new PublicKey('FiiHMy7ym4iDc8Cor26WqzwWdSPWNgfc3isa2WPCjs7k'),
    payoutAsset: new PublicKey('BUD1144GGYwmMRFs4Whjfkom5UHqC9a8dZHPVvR2vfPx'),
    vestConfig: new PublicKey('CxHKqMnY8bf8NsmhfC4AbwYy9Hg1rCYHmRdbgBwnojs3'),
  }
];

export const devnetBondings: BondingConfig[] = [
  {
    address: new PublicKey('6YTSDJNzhTn4agLV26demFHDRCUWtBxNrnpti7XhaMJE'),
    staking: new PublicKey('J3wqkYG1qq46S8WJ6pf8FaV5f7dZdAXviSftAUgDRD26'),
    vestConfig: new PublicKey('74geuqwioFsijC8j1UbrVdtr21Q5etd3Qi73ciQQ1r4e'),
    payoutAsset: new PublicKey('BUDkmty8HggNkNvVfRAUJXvSuW4kar9ZtPUG5grNttQ4'),
  },

];