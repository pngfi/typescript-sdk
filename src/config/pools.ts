import { PublicKey } from '@solana/web3.js';

import { PoolConfig } from '../types';

export const pools: PoolConfig[] = [
  {
    pair: 'SOL_USDC',
    addr: new PublicKey('5niCukG5maB72UcaGaHAg5GiFrfNY6mEddrdA8FcDFNp')
  },
  {
    pair: 'PRT_USDC',
    addr: new PublicKey('24ZbKS36rkPv14Tdx8qv4NRyqatTaJ5KgJrT1LxBKn5d')
  },
  {
    pair: 'weWETH_PAI',
    addr: new PublicKey('VG7NmfRs1tbhM6CZQYWq7kkLdXn4A9JEiWzi9XrR39Y')
  },
  {
    pair: 'PRT_PAI',
    addr: new PublicKey('2UL11LuTTAdSNpZDyampYxVCHu4hgfuVbemWTWEHfpTj')
  },
  {
    pair: 'prtSOL_USDC',
    addr: new PublicKey('FYa5wW5UxE4cnxZ5bBsDyRSzXKCMyTjPYuCLGwmRbfWM')
  }
];
