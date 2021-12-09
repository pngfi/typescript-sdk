import { PublicKey } from '@solana/web3.js';

import { PoolConfig } from '../types';

export const mainnetPools: PoolConfig[] = [
  // {
  //   pair: 'SOL_USDC',
  //   addr: new PublicKey('5niCukG5maB72UcaGaHAg5GiFrfNY6mEddrdA8FcDFNp')
  // },
  // {
  //   pair: 'PRT_USDC',
  //   addr: new PublicKey('24ZbKS36rkPv14Tdx8qv4NRyqatTaJ5KgJrT1LxBKn5d')
  // },
  {
    pair: 'weWETH_PAI',
    addr: new PublicKey('VG7NmfRs1tbhM6CZQYWq7kkLdXn4A9JEiWzi9XrR39Y')
  },
  {
    pair: 'BTC_PAI',
    addr: new PublicKey('9SWfJbEH97fkSU31E74vDAPT3r7XvQynzTDns6Ve9iyk')
  },
  {
    pair: 'PRT_PAI',
    addr: new PublicKey('2UL11LuTTAdSNpZDyampYxVCHu4hgfuVbemWTWEHfpTj')
  },
  {
    pair: 'prtSOL_PAI',
    addr: new PublicKey('3SkEYge7DxgrSMevRsHCAMEPi69sJ9JDDq5ZqyWDZFxi')
  },
  {
    pair: 'SOL_PAI',
    addr: new PublicKey('GfgZJgNycWxsc5K8xB6F75KDHKsR71gQXCtkhx7PPfQ5')
  }
];

export const devnetPools: PoolConfig[] = [
  {
    pair: 'SOL_USDC',
    addr: new PublicKey('6VznpsWwaJjDiWF7A6xZosKHb8AbtG29wrJbK5ysHRfg')
  },
  {
    pair: 'PNG_USDC',
    addr: new PublicKey('3HdXX7jhbq7EF2fpaB7iPt8J8N5MwTYii6FYhwySakg7')
  }
];