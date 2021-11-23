import Decimal from 'decimal.js';

export type GlobalInfo = {
  walletName: string;
  slippage: number;
}

export type Message = {
  duration?: number;
  doNotAutoRemove?: boolean;
  title: string;
  description: string;
  status: 'success'|'error'|'info'|'loading';
  link?: string;
}

export type Transaction = {
  hash: string;
  status: 'success'|'error'|'loading';
  summary: string;
  addedTime: number;
  from: string;
}

export type BalancesRecord = Record<string, Decimal>;
export type TransactionsRecord = Record<string, Transaction>;
export type MessagesRecord = Record<string, Message>;
export type PricesRecord = Record<string, number>;

export type FeeStructure = {
  tradeFeeNumerator: number;
  tradeFeeDenominator: number;
  ownerTradeFeeNumerator: number;
  ownerTradeFeeDenominator: number;
  ownerWithdrawFeeNumerator: number;
  ownerWithdrawFeeDenominator: number;
}