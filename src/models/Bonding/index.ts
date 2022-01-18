import {
  BondingInfo,
  BondingConfig,
  PayoutInfo
} from '../../types';

import {
  PNG_BONDING_ID,
  DecimalUtil,
  deriveAssociatedTokenAddress,
  resolveOrCreateAssociatedTokenAddress,
} from '../../utils';

import { PublicKey } from '@solana/web3.js';

import { u64, TOKEN_PROGRAM_ID } from '@solana/spl-token';

import idl from './idl.json';

import { Idl, Program, Provider } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import Decimal from 'decimal.js';

const BONDING_SEED_PREFIX = 'bonding_authority';

export class Bonding {
  public config: BondingConfig;
  public bondingInfo: BondingInfo;
  private program: Program;

  constructor(provider: Provider, config: BondingConfig, bondingInfo: BondingInfo) {
    this.config = config;
    this.bondingInfo = bondingInfo;
    this.program = new Program(idl as Idl, PNG_BONDING_ID, provider as any);
  }

  /* async getBondingInfo(): Promise<BondingInfo> {
    const {
      payoutHolder,
      payoutTokenMint,
      depositHolder,
      depositTokenMint,
      bondingSupply,
      maxPayoutFactor,
      initDebt,
      maxDebt,
      minPrice,
      totalDebt,
      controlVariable,
      decayFactor,
      lastDecay
    } = await this.program.account.bonding.fetch(this.config.address);

    const depositHolderInfo = await getTokenAccountInfo(this.program.provider as any, depositHolder);

    return {
      address: this.config.address,
      payoutHolder,
      payoutTokenMint,
      depositHolder,
      depositTokenMint,
      depositHolderAmount: depositHolderInfo?.amount || ZERO_U64,
      bondingSupply,
      maxPayoutFactor,
      initDebt,
      maxDebt,
      minPrice,
      totalDebt,
      controlVariable: controlVariable.toNumber(),
      decayFactor: decayFactor.toNumber(),
      lastDecay: lastDecay.toNumber()
    }
  } */

  private decay(bondingInfo: BondingInfo): u64 {
    const { lastDecay, totalDebt, decayFactor } = bondingInfo;

    const duration = Math.floor(new Date().getTime() / 1000 - lastDecay);
    const decay = totalDebt.mul(new u64(duration)).div(new u64(decayFactor));

    return decay.gt(totalDebt) ? totalDebt : decay;
  }

  private valueOf(amount: u64, payoutTokenDecimals: number, depositTokenDecimals: number): u64 {
    return amount
      .mul(new u64(Math.pow(10, payoutTokenDecimals)))
      .div(new u64(Math.pow(10, depositTokenDecimals)));
  }

  private debtRatio(totalDebt: u64, tokenSupply: u64, payoutTokenDecimals: number, bondingInfo: BondingInfo): u64 {
    return totalDebt
      .sub(this.decay(bondingInfo))
      .mul(new u64(Math.pow(10, payoutTokenDecimals)))
      .div(tokenSupply);
  }

  private price(bondingInfo: BondingInfo, payoutTokenDecimals: number): u64 {
    const { totalDebt, bondingSupply, controlVariable, minPrice } = bondingInfo;
    const debtRatio = this.debtRatio(totalDebt, bondingSupply, payoutTokenDecimals, bondingInfo);

    const price = debtRatio
      .mul(new u64(controlVariable))
      .div(new u64(Math.pow(10, payoutTokenDecimals - 3)));

    return price.lt(minPrice) ? minPrice : price;
  }

  calcPayout(
    bondingInfo: BondingInfo,
    payoutTokenDecimals: number,
    depositTokenDecimals: number,
    amount = 1
  ): PayoutInfo {

    const valuation = this.valueOf(
      DecimalUtil.toU64(new Decimal(amount), depositTokenDecimals),
      payoutTokenDecimals,
      depositTokenDecimals
    );

    const price = this.price(bondingInfo, payoutTokenDecimals);
    const payout = valuation.mul(new u64(Math.pow(10, 5))).div(price);

    return {
      payoutAmount: payout,
      internalPrice: price
    }

  }

  async bond(amount: u64): Promise<TransactionEnvelope> {

    const owner = this.program.provider.wallet?.publicKey;
    // const bondingInfo = await this.getBondingInfo();

    const [bondingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(BONDING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const userDepositHolder = await deriveAssociatedTokenAddress(owner, this.bondingInfo.depositTokenMint);

    const { address: userPayoutHolder, ...resolveUserPayoutHolderInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        this.bondingInfo.payoutTokenMint,
        amount
      );

    const bondInstruction = this.program.instruction.bond(
      amount,
      new u64(1e12),
      {
        accounts: {
          bonding: this.config.address,
          bondingPda,
          depositTokenMint: this.bondingInfo.depositTokenMint,
          depositHolder: this.bondingInfo.depositHolder,
          payoutHolder: this.bondingInfo.payoutHolder,
          payoutTokenMint: this.bondingInfo.payoutTokenMint,
          userDepositHolder,
          userPayoutHolder,
          owner,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      }
    );

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...resolveUserPayoutHolderInstrucitons.instructions,
        bondInstruction
      ],
      [
        ...resolveUserPayoutHolderInstrucitons.signers
      ]
    );

  }

}