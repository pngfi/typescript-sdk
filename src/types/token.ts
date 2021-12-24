export type Token = {
  symbol: string;
  mint: string;
  name: string;
  decimals: number;
  tags?: string[];
  extensions?: Record<string, string>;
  chainId?: number;
  logoURI?: string;
  fetchPrice?: boolean;
  isLP?: boolean;
  display?: boolean;
}