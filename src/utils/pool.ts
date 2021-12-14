import { Connection, PublicKey } from '@solana/web3.js';

import {
  getTokenByMint,
  deserializeAccount,
  DecimalUtil,
  ONE_HUNDRED_DECIMAL,
  ZERO_U64,
  CurveType,
  ZERO_DECIMAL,
} from '.';

import type { PoolInfo, Token } from '../types';
import { Token as SPLToken, TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token';
import { TokenSwapLayout, Numberu64 } from '@solana/spl-token-swap';

const emptyToken: Token = {
  symbol: '',
  mint: '',
  name: '',
  decimals: 1
}

const emptyPool = {
  address: PublicKey.default,
  nonce: 0,
  authority: PublicKey.default,
  poolTokenMint: PublicKey.default,
  poolTokenDecimals: 1,
  feeAccount: PublicKey.default,
  curveType: CurveType.ConstantProduct,
  feeStructure: {
    tradeFeeNumerator: 0,
    tradeFeeDenominator: 0,
    ownerTradeFeeNumerator: 0,
    ownerTradeFeeDenominator: 0,
    ownerWithdrawFeeNumerator: 0,
    ownerWithdrawFeeDenominator: 0
  },
  tokenA: {
    ...emptyToken,
    addr: PublicKey.default,
    amount: ZERO_U64
  },
  tokenB: {
    ...emptyToken,
    addr: PublicKey.default,
    amount: ZERO_U64
  },
  lpSupply: ZERO_DECIMAL
}

export async function getPoolInfo(
  connection: Connection,
  poolAddr: PublicKey,
  tokens: Token[]
): Promise<PoolInfo> {

  const poolAccountInfo = await connection.getAccountInfo(poolAddr);

  if (!poolAccountInfo) {
    return emptyPool;
  }
  
  const decodedInfo = TokenSwapLayout.decode(Buffer.from(poolAccountInfo.data));

  const poolMint = new PublicKey(decodedInfo.tokenPool);
  const feeAccount = new PublicKey(decodedInfo.feeAccount);
  const tokenAccountA = new PublicKey(decodedInfo.tokenAccountA);
  const tokenAccountB = new PublicKey(decodedInfo.tokenAccountB);
  const mintA = new PublicKey(decodedInfo.mintA);
  const mintB = new PublicKey(decodedInfo.mintB);

  const nonce = decodedInfo.nonce;

  const tradeFeeNumerator = Numberu64.fromBuffer(
    decodedInfo.tradeFeeNumerator,
  );
  const tradeFeeDenominator = Numberu64.fromBuffer(
    decodedInfo.tradeFeeDenominator,
  );
  const ownerTradeFeeNumerator = Numberu64.fromBuffer(
    decodedInfo.ownerTradeFeeNumerator,
  );
  const ownerTradeFeeDenominator = Numberu64.fromBuffer(
    decodedInfo.ownerTradeFeeDenominator,
  );
  const ownerWithdrawFeeNumerator = Numberu64.fromBuffer(
    decodedInfo.ownerWithdrawFeeNumerator,
  );
  const ownerWithdrawFeeDenominator = Numberu64.fromBuffer(
    decodedInfo.ownerWithdrawFeeDenominator,
  );
 
  const curveType = decodedInfo.curveType;

  const poolToken = new SPLToken(
    connection,
    poolMint,
    TOKEN_PROGRAM_ID,
    {} as any
  );

  const poolTokenInfo = await poolToken.getMintInfo();

  // TODO: Batch request?
  const accountInfos = await Promise.all([
    connection.getAccountInfo(tokenAccountA),
    connection.getAccountInfo(tokenAccountB),
  ]);

  const [tokenAccountAInfo, tokenAccountBInfo] = accountInfos.map((info) =>
    info ? deserializeAccount(info.data) : null
  );

  const lpSupplyInfo = await connection.getTokenSupply(poolMint);

  const tokenA = getTokenByMint(mintA.toString(), tokens);
  const tokenB = getTokenByMint(mintB.toString(), tokens);

  return {
    address: poolAddr,
    nonce,
    authority: poolTokenInfo.mintAuthority || PublicKey.default,
    poolTokenMint: poolMint,
    poolTokenDecimals: poolTokenInfo.decimals,
    feeAccount: feeAccount,
    lpSupply: DecimalUtil.fromString(
      lpSupplyInfo.value.amount, 
      poolTokenInfo.decimals
    ),
    tokenA: {
      ...(tokenA || emptyToken),
      addr: tokenAccountA,
      amount: tokenAccountAInfo ? new u64(tokenAccountAInfo.amount) : ZERO_U64
    },
    tokenB: {
      ...(tokenB || emptyToken),
      addr: tokenAccountB,
      amount: tokenAccountBInfo ? new u64(tokenAccountBInfo.amount) : ZERO_U64
    },
    curveType,
    feeStructure: {
      tradeFeeNumerator: tradeFeeNumerator.toNumber(),
      tradeFeeDenominator: tradeFeeDenominator.toNumber(),
      ownerTradeFeeNumerator: ownerTradeFeeNumerator.toNumber(),
      ownerTradeFeeDenominator: ownerTradeFeeDenominator.toNumber(),
      ownerWithdrawFeeNumerator: ownerWithdrawFeeNumerator.toNumber(),
      ownerWithdrawFeeDenominator: ownerWithdrawFeeDenominator.toNumber()
    }
  };
}

export function computeLPPrice(pool: PoolInfo, prices: Record<string, number>): number {

  const { tokenA, tokenB, lpSupply } = pool;

  const inputTokenCount = DecimalUtil.fromU64(
    tokenA.amount,
    tokenA.decimals
  ).toNumber();

  const outputTokenCount = DecimalUtil.fromU64(
    tokenB.amount,
    tokenB.decimals
  ).toNumber();

  const a2brate = outputTokenCount / inputTokenCount;

  let priceA = prices[tokenA.symbol] || 0,
    priceB = prices[tokenB.symbol] || 0;

  if (priceA && !priceB) {
    priceB = priceA / a2brate;
  } else if (priceB && !priceA) {
    priceA = priceB * a2brate;
  }

  const totalValue = inputTokenCount * priceA + outputTokenCount * priceB;
  return totalValue / lpSupply.toNumber();

}

export function getTokenPriceViaPools(
  tokenSymbol: string, 
  poolInfos: PoolInfo[], 
  prices: Record<string, number>
): number {

  const pool = poolInfos.find(pool => (pool.tokenA.symbol || pool.tokenB.symbol) === tokenSymbol);

  if (!pool) {
    return 0;
  }

  const { tokenA, tokenB } = pool;

  const inputTokenCount = DecimalUtil.fromU64(
    tokenA.amount,
    tokenA.decimals
  ).toNumber();

  const outputTokenCount = DecimalUtil.fromU64(
    tokenB.amount,
    tokenB.decimals
  ).toNumber();

  const a2brate = outputTokenCount / inputTokenCount;
  
  let priceA = prices[tokenA.symbol] || 0,
    priceB = prices[tokenB.symbol] || 0;

  if (priceA && !priceB) {
    priceB = priceA / a2brate;
  } else if (priceB && !priceA) {
    priceA = priceB * a2brate;
  }

  return tokenSymbol === tokenA.symbol ? priceA : priceB;

}

export function computeRate(
  pool: PoolInfo,
  inputToken?: Token
): number {

  const { tokenA, tokenB } = pool;

  const forward = inputToken ? inputToken.mint === tokenA.mint : true;
  const inputTokenCount = forward ? tokenA.amount : tokenB.amount;
  const outputTokenCount = forward ? tokenB.amount : tokenA.amount;

  return DecimalUtil
    .fromU64(outputTokenCount, (forward ? tokenB : tokenA).decimals)
    .div(
      DecimalUtil.fromU64(inputTokenCount, (forward ? tokenA : tokenB).decimals)
    ).toNumber();

}

export function getTokenPercent(pool: PoolInfo): {
  tokenAPercent: number, tokenBPercent: number
} {
  const { tokenA, tokenB } = pool;
 
  return {
    tokenAPercent:
      DecimalUtil
        .fromU64(tokenA.amount, tokenA.decimals)
        .mul(ONE_HUNDRED_DECIMAL)
        .div(
          DecimalUtil
            .fromU64(tokenA.amount, tokenA.decimals)
            .add(
              DecimalUtil
                .fromU64(tokenB.amount, tokenB.decimals)
            )
        ).toNumber(),
    tokenBPercent:
      DecimalUtil
        .fromU64(tokenB.amount, tokenB.decimals)
        .mul(ONE_HUNDRED_DECIMAL)
        .div(
          DecimalUtil
            .fromU64(tokenA.amount, tokenA.decimals)
            .add(
              DecimalUtil
                .fromU64(tokenB.amount, tokenB.decimals)
            )
        ).toNumber()
  }

}
