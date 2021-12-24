import { PublicKey } from '@solana/web3.js';
import { FeeStructure } from '../types';

export const PNG_TOKEN_SWAP_ID: PublicKey = new PublicKey('PSwapMdSai8tjrEXcxFeQth87xC4rRsa4VA5mhGhXkP');

export const PNG_BONDING_ID: PublicKey = new PublicKey('PBondLKEdykMYSwuBZ7mQ5nWQtihdSynzUXNzKPTznh');
export const PNG_VESTING_ID: PublicKey = new PublicKey('PVeEcTWw5YuZih7848DGK5MRTTtaRpiimQntHd3NSND');
export const PNG_STAKING_ID: PublicKey = new PublicKey('PStkCKhx3A4oJdeCXspZeePgQcZyQXAV74ocScbjJJh');

export const PNG_TOKEN_SWAP_FEE_ACCOUNT_OWNER = new PublicKey('3M1gJoNCxuw6GBMRatHzCvxwbQMiUZ6VoG22UCjubQZq');

export const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

export const PNG_TOKEN_SWAP_FEE_STRUCTURE: FeeStructure = {
  tradeFeeNumerator: 25,
  tradeFeeDenominator: 10000,
  ownerTradeFeeNumerator: 5,
  ownerTradeFeeDenominator: 10000,
  ownerWithdrawFeeNumerator: 0,
  ownerWithdrawFeeDenominator: 0
}

export enum CurveType {
  ConstantProduct,
  ConstantPrice,
  Stable,
  Offset
}