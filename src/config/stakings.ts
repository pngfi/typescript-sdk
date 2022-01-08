import { PublicKey } from '@solana/web3.js';
import { StakingConfig } from '../types';

export const mainnetStakings: StakingConfig[] = [
  {
    address: new PublicKey('FiiHMy7ym4iDc8Cor26WqzwWdSPWNgfc3isa2WPCjs7k'),
    vestConfig: new PublicKey('CxHKqMnY8bf8NsmhfC4AbwYy9Hg1rCYHmRdbgBwnojs3'),
    payoutAsset: new PublicKey('BUD1144GGYwmMRFs4Whjfkom5UHqC9a8dZHPVvR2vfPx'),
  }
];

export const devnetStakings: StakingConfig[] = [
  {
    address: new PublicKey('J3wqkYG1qq46S8WJ6pf8FaV5f7dZdAXviSftAUgDRD26'),
    vestConfig: new PublicKey('74geuqwioFsijC8j1UbrVdtr21Q5etd3Qi73ciQQ1r4e'),
    payoutAsset: new PublicKey('BUDkmty8HggNkNvVfRAUJXvSuW4kar9ZtPUG5grNttQ4'),
  }
];