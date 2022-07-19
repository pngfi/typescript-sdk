import type { Provider } from '@saberhq/solana-contrib';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TokenSwapLayout, TokenSwap, Numberu64 } from '@solana/spl-token-swap';
import Decimal from 'decimal.js';

import {
  Token as SPLToken,
  TOKEN_PROGRAM_ID,
  u64
} from '@solana/spl-token';

import {
  PoolInfo,
  Token,
  WithdrawQuote,
  DepositQuote
} from '../types';

import {
  resolveOrCreateAssociatedTokenAddress,
  DecimalUtil,
  createTokenAccount,
  createTokenMint,
  PNG_TOKEN_SWAP_ID,
  PNG_TOKEN_SWAP_FEE_STRUCTURE,
  PNG_TOKEN_SWAP_FEE_ACCOUNT_OWNER,
  CurveType,
  ZERO_U64,
  TransactionBuilder,
  ONE_THOUSAND_U64,
  ZERO_DECIMAL
} from '../utils';

import {
  createInitSwapInstruction,
  createApprovalInstruction
} from '../instructions';

export class Pool {
  private provider: Provider;
  private info: PoolInfo;

  constructor(provider: Provider, info: PoolInfo) {
    this.provider = provider;
    this.info = info;
  }

  // Create a Pool
  static async createPool(
    provider: Provider,
    owner: PublicKey,
    tradeFee: number,
    inputToken: Token,
    outputToken: Token,
    inputTokenAmount: Decimal,
    outputTokenAmount: Decimal,
  ): Promise<{
    address: PublicKey,
    mint: PublicKey,
    tx: TransactionEnvelope
  }> {

    const swapAccount = Keypair.generate();

    const inputTokenMint = new PublicKey(inputToken.mint),
      outputTokenMint = new PublicKey(outputToken.mint);

    const [authority] = await PublicKey.findProgramAddress(
      [swapAccount.publicKey.toBuffer()],
      PNG_TOKEN_SWAP_ID,
    );

    // If tokenA is SOL, this will create a new wSOL account with maxTokenAIn_U64
    // Otherwise, get tokenA's associated token account
    const { address: userTokenAPublicKey, ...resolveTokenAInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        provider.connection,
        owner,
        inputTokenMint,
        DecimalUtil.toU64(inputTokenAmount, inputToken.decimals)
      );

    // If tokenB is SOL, this will create a new wSOL account with maxTokenBIn_U64
    // Otherwise, get tokenB's associated token account
    const { address: userTokenBPublicKey, ...resolveTokenBInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        provider.connection,
        owner,
        new PublicKey(outputTokenMint),
        DecimalUtil.toU64(outputTokenAmount, outputToken.decimals)
      );

    const { address: swapTokenAAccount, ...resolveTokenAAccountInstrucitons } = await createTokenAccount({
      provider,
      mint: inputTokenMint,
      owner: authority
    });

    const { address: swapTokenBAccount, ...resolveTokenBAccountInstrucitons } = await createTokenAccount({
      provider,
      mint: outputTokenMint,
      owner: authority
    });

    const transferTokenAInstruction = SPLToken.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      userTokenAPublicKey,
      swapTokenAAccount,
      owner,
      [],
      DecimalUtil.toU64(inputTokenAmount, inputToken.decimals)
    );

    const transferTokenBInstruction = SPLToken.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      userTokenBPublicKey,
      swapTokenBAccount,
      owner,
      [],
      DecimalUtil.toU64(outputTokenAmount, outputToken.decimals)
    );

    const poolMintKP = Keypair.generate();

    const createPoolMintInstructions = await createTokenMint(
      provider,
      authority,
      poolMintKP.publicKey,
      6, // pool token decimals
    );

    const { address: feeAccount, ...resolveFeeAccountInstructions } = await createTokenAccount({
      provider,
      mint: poolMintKP.publicKey,
      owner: PNG_TOKEN_SWAP_FEE_ACCOUNT_OWNER
    });

    // If the user lacks the pool token account, create it
    const { address: userPoolTokenPublicKey, ...resolvePoolTokenInstructions } =
      await resolveOrCreateAssociatedTokenAddress(
        provider.connection,
        owner,
        poolMintKP.publicKey
      );

    const intializeInstruction = createInitSwapInstruction(
      swapAccount,
      authority,
      swapTokenAAccount,
      swapTokenBAccount,
      poolMintKP.publicKey,
      feeAccount,
      userPoolTokenPublicKey,
      TOKEN_PROGRAM_ID,
      PNG_TOKEN_SWAP_ID,
      tradeFee,
      PNG_TOKEN_SWAP_FEE_STRUCTURE.tradeFeeDenominator,
      PNG_TOKEN_SWAP_FEE_STRUCTURE.ownerTradeFeeNumerator,
      PNG_TOKEN_SWAP_FEE_STRUCTURE.ownerTradeFeeDenominator,
      PNG_TOKEN_SWAP_FEE_STRUCTURE.ownerWithdrawFeeNumerator,
      PNG_TOKEN_SWAP_FEE_STRUCTURE.ownerWithdrawFeeDenominator,
      20,
      100,
      CurveType.ConstantProduct,
    );

    const balanceNeeded = await provider.connection.getMinimumBalanceForRentExemption(
      TokenSwapLayout.span
    );

    const createSwapAccountInstruction = SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: swapAccount.publicKey,
      lamports: balanceNeeded,
      space: TokenSwapLayout.span,
      programId: PNG_TOKEN_SWAP_ID,
    });

    await new TransactionEnvelope(
      provider,
      [
        ...createPoolMintInstructions.instructions,
        ...resolveTokenAAccountInstrucitons.instructions,
        ...resolveTokenBAccountInstrucitons.instructions,
        ...resolveFeeAccountInstructions.instructions,
      ],
      [
        poolMintKP,
        ...resolveTokenAAccountInstrucitons.signers,
        ...resolveTokenBAccountInstrucitons.signers,
        ...resolveFeeAccountInstructions.signers,
      ]
    ).confirm();

    const tx = new TransactionEnvelope(
      provider,
      [
        ...resolveTokenAInstrucitons.instructions,
        ...resolveTokenBInstrucitons.instructions,
        ...resolvePoolTokenInstructions.instructions,

        transferTokenAInstruction,
        transferTokenBInstruction,
        createSwapAccountInstruction,
        intializeInstruction,
      ],
      [
        ...resolveTokenAInstrucitons.signers,
        ...resolveTokenBInstrucitons.signers,
        ...resolvePoolTokenInstructions.signers,

        swapAccount
      ]
    );

    return {
      address: swapAccount.publicKey,
      mint: poolMintKP.publicKey,
      tx
    }
  }

  public async getDepositQuote(
    maxTokenAIn: Decimal,
    maxTokenBIn: Decimal,
    slippage = 1
  ): Promise<DepositQuote> {

    const { tokenA, tokenB, lpSupply, poolTokenDecimals } = this.info;

    const lpSupply_U64 = DecimalUtil.toU64(lpSupply, poolTokenDecimals)
    const maxTokenAIn_U64 = DecimalUtil.toU64(maxTokenAIn, tokenA.decimals);
    const maxTokenBIn_U64 = DecimalUtil.toU64(maxTokenBIn, tokenB.decimals);

    if (tokenA.amount.eq(ZERO_U64) || tokenB.amount.eq(ZERO_U64)) {
      return {
        minPoolTokenAmountOut: ZERO_U64,
        maxTokenAIn: maxTokenAIn_U64,
        maxTokenBIn: maxTokenBIn_U64,
      };
    }

    const poolTokenAmountWithA = maxTokenAIn_U64
      .mul(ONE_THOUSAND_U64)
      .mul(lpSupply_U64)
      .div(tokenA.amount)
      .div(new u64(slippage).add(ONE_THOUSAND_U64));

    const poolTokenAmountWithB = maxTokenBIn_U64
      .mul(ONE_THOUSAND_U64)
      .mul(lpSupply_U64)
      .div(tokenB.amount)
      .div(new u64(slippage).add(ONE_THOUSAND_U64));

    // Pick the smaller value of the two to calculate the minimum poolTokenAmount out
    const minPoolTokenAmountOut_U64 = poolTokenAmountWithA.gt(poolTokenAmountWithB)
      ? poolTokenAmountWithB
      : poolTokenAmountWithA;

    return {
      minPoolTokenAmountOut: minPoolTokenAmountOut_U64,
      maxTokenAIn: maxTokenAIn_U64,
      maxTokenBIn: maxTokenBIn_U64,
    };
  }

  public async deposit(
    owner: PublicKey,
    maxTokenAIn: Decimal,
    maxTokenBIn: Decimal,
    minPoolTokenAmountOut: Decimal
  ): Promise<TransactionEnvelope> {

    const { tokenA, tokenB, poolTokenDecimals } = this.info;

    const maxTokenAIn_U64 = DecimalUtil.toU64(maxTokenAIn, tokenA.decimals);
    const maxTokenBIn_U64 = DecimalUtil.toU64(maxTokenBIn, tokenB.decimals);
    const minPoolTokenAmountOut_U64 = DecimalUtil.toU64(
      minPoolTokenAmountOut,
      poolTokenDecimals
    );

    // If tokenA is SOL, this will create a new wSOL account with maxTokenAIn_U64
    // Otherwise, get tokenA's associated token account
    const { address: userTokenAPublicKey, ...resolveTokenAInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.provider.connection,
        owner,
        new PublicKey(tokenA.mint),
        maxTokenAIn_U64
      );
    
    // If tokenB is SOL, this will create a new wSOL account with maxTokenBIn_U64
    // Otherwise, get tokenB's associated token account
    const { address: userTokenBPublicKey, ...resolveTokenBInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.provider.connection,
        owner,
        new PublicKey(tokenB.mint),
        maxTokenBIn_U64
      );

    // If the user lacks the pool token account, create it
    const { address: userPoolTokenPublicKey, ...resolvePoolTokenInstructions } =
      await resolveOrCreateAssociatedTokenAddress(
        this.provider.connection,
        owner,
        this.info.poolTokenMint
      );

    // Approve transfer of the tokens being deposited
    const { userTransferAuthority, ...transferTokenAInstruction } = createApprovalInstruction(
      owner,
      maxTokenAIn_U64,
      userTokenAPublicKey
    );

    const { ...transferTokenBInstruction } = createApprovalInstruction(
      owner,
      maxTokenBIn_U64,
      userTokenBPublicKey,
      userTransferAuthority
    );

    const depositInstruction = TokenSwap.depositAllTokenTypesInstruction(
      this.info.address,
      this.info.authority,
      userTransferAuthority.publicKey,
      userTokenAPublicKey,
      userTokenBPublicKey,
      tokenA.addr,
      tokenB.addr,
      this.info.poolTokenMint,
      userPoolTokenPublicKey,
      PNG_TOKEN_SWAP_ID,
      TOKEN_PROGRAM_ID,
      minPoolTokenAmountOut_U64,
      maxTokenAIn_U64,
      maxTokenBIn_U64
    );

    return new TransactionBuilder(this.provider as any)
      .addInstruction(resolveTokenAInstrucitons)
      .addInstruction(resolveTokenBInstrucitons)
      .addInstruction(resolvePoolTokenInstructions)
      .addInstruction(transferTokenAInstruction)
      .addInstruction(transferTokenBInstruction)
      .addInstruction({
        instructions: [depositInstruction],
        cleanupInstructions: [],
        signers: [
          userTransferAuthority
        ]
      })
      .build();
  }

  static computeWithdrawQuote(
    config: PoolInfo,
    withdrawTokenAmount: Decimal,
    withdrawTokenMint: PublicKey,
    slippage = 1
  ): WithdrawQuote {

    const { tokenA, tokenB, poolTokenMint, poolTokenDecimals, lpSupply } = config;

    // withdrawTokenAmount needs represent amounts for one of the following: poolTokenAmount, tokenAAmount, or tokenBAmount
    // determine which token this amount represents, then calculate poolTokenIn_U64
    let poolTokenIn_U64 = ZERO_U64;

    const lpSupplyIn_U64 = DecimalUtil.toU64(lpSupply, poolTokenDecimals);
    if (withdrawTokenMint.equals(poolTokenMint)) {

      poolTokenIn_U64 = DecimalUtil.toU64(
        withdrawTokenAmount,
        poolTokenDecimals
      );

    } else if (
      withdrawTokenMint.equals(new PublicKey(tokenA.mint)) ||
      withdrawTokenMint.equals(new PublicKey(tokenB.mint))
    ) {
      const token = withdrawTokenMint.equals(new PublicKey(tokenA.mint))
        ? tokenA
        : tokenB;

      const totalAmount = token.mint === tokenA.mint ? tokenA.amount : tokenB.amount;

      const numerator = withdrawTokenAmount;
      const denominator = DecimalUtil.fromU64(totalAmount, token.decimals);
      const poolTokenIn = lpSupply.div(denominator).mul(numerator);

      poolTokenIn_U64 = DecimalUtil.toU64(poolTokenIn, poolTokenDecimals);
    } else {
      throw new Error(
        `Unable to get withdraw quote with an invalid withdrawTokenMint ${withdrawTokenMint}`
      );
    }

    if (poolTokenIn_U64.eq(ZERO_U64)) {
      return {
        maxPoolTokenAmountIn: ZERO_U64,
        minTokenAOut: ZERO_U64,
        minTokenBOut: ZERO_U64,
      };
    }

    const minTokenAOut =
      poolTokenIn_U64
        .mul(ONE_THOUSAND_U64)
        .mul(tokenA.amount)
        .div(lpSupplyIn_U64)
        .div(new u64(slippage).add(ONE_THOUSAND_U64));

    const minTokenBOut =
      poolTokenIn_U64
        .mul(ONE_THOUSAND_U64)
        .mul(tokenB.amount)
        .div(lpSupplyIn_U64)
        .div(new u64(slippage).add(ONE_THOUSAND_U64));

    return {
      maxPoolTokenAmountIn: poolTokenIn_U64,
      minTokenAOut,
      minTokenBOut,
    };
  }

  public async withdraw(
    owner: PublicKey,
    poolTokenAmountIn: Decimal
  ): Promise<TransactionEnvelope> {

    const { tokenA, tokenB, feeStructure, poolTokenDecimals, lpSupply } = this.info;

    let feeAmount = ZERO_DECIMAL;
    if (feeStructure.ownerWithdrawFeeNumerator !== 0) {
      feeAmount = poolTokenAmountIn.mul(
        new Decimal(feeStructure.ownerWithdrawFeeNumerator)
      ).div(feeStructure.ownerWithdrawFeeDenominator);
    }

    const poolTokenAmount = poolTokenAmountIn.sub(feeAmount);

    const poolTokenAmount_U64 = DecimalUtil.toU64(
      poolTokenAmount,
      poolTokenDecimals
    );

    const lpSupplyIn_U64 = DecimalUtil.toU64(lpSupply, poolTokenDecimals);

    const tokenAAmount =
      tokenA.amount
        .mul(poolTokenAmount_U64)
        .div(lpSupplyIn_U64);

    const tokenBAmount =
      tokenB.amount
        .mul(poolTokenAmount_U64)
        .div(lpSupplyIn_U64);

    // Create a token account for tokenA, if necessary
    const { address: userTokenAPublicKey, ...resolveTokenAInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(this.provider.connection, owner, new PublicKey(tokenA.mint));

    // Create a token account for tokenB, if necessary
    const { address: userTokenBPublicKey, ...resolveTokenBInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(this.provider.connection, owner, new PublicKey(tokenB.mint));

    // Get user's poolToken token account
    const { address: userPoolTokenPublicKey, ...resolvePoolTokenInstructions } =
      await resolveOrCreateAssociatedTokenAddress(
        this.provider.connection,
        owner,
        this.info.poolTokenMint
      );

    // Approve transfer of pool token
    const { userTransferAuthority, ...transferPoolTokenInstruction } = createApprovalInstruction(
      owner,
      poolTokenAmount_U64,
      userPoolTokenPublicKey
    );

    const withdrawInstruction = TokenSwap.withdrawAllTokenTypesInstruction(
      this.info.address,
      this.info.authority,
      userTransferAuthority.publicKey,
      this.info.poolTokenMint,
      this.info.feeAccount,
      userPoolTokenPublicKey,
      tokenA.addr,
      tokenB.addr,
      userTokenAPublicKey,
      userTokenBPublicKey,
      PNG_TOKEN_SWAP_ID,
      TOKEN_PROGRAM_ID,
      new Numberu64(poolTokenAmount_U64.toString()),
      new Numberu64(tokenAAmount.toString()),
      new Numberu64(tokenBAmount.toString())
    );

    return new TransactionBuilder(this.provider as any)
      .addInstruction(resolveTokenAInstrucitons)
      .addInstruction(resolveTokenBInstrucitons)
      .addInstruction(resolvePoolTokenInstructions)
      .addInstruction(transferPoolTokenInstruction)
      .addInstruction({
        instructions: [withdrawInstruction],
        cleanupInstructions: [],
        signers: [userTransferAuthority]
      })
      .build();
  }

}