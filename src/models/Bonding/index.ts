import { 
  BondingInfo, 
  BondingConfig,
  VestConfigInfo,
  StakingInfo,
  PayoutInfo
} from '../../types';

import {
  PNG_BONDING_ID,
  PNG_VESTING_ID,
  PNG_STAKING_ID,
  DecimalUtil,
  ZERO_DECIMAL,
  deriveAssociatedTokenAddress,
  resolveOrCreateAssociatedTokenAddress,
  ZERO_U64,
  getTokenAccountInfo,
  getTokenMintInfo
} from '../../utils';

import {
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram
} from '@solana/web3.js';

import {
  u64,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

import idl from './idl.json';

import { Idl, Program, Provider } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import Decimal from 'decimal.js';

const BONDING_SEED_PREFIX = 'bonding_authority';

export class Bonding {
  public config: BondingConfig;
  private program: Program;

  constructor(provider: Provider, config: BondingConfig) {
    this.config = config;
    this.program = new Program(idl as Idl, PNG_BONDING_ID, provider as any);
  }

  async getBondingInfo(): Promise<BondingInfo> {
    const {
      payoutHolder,
      payoutTokenMint,
      depositHolder,
      depositTokenMint,
      bondingSupply,
      maxPayout,
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
      maxPayout,
      maxDebt,
      minPrice,
      totalDebt,
      controlVariable: controlVariable.toNumber(),
      decayFactor: decayFactor.toNumber(),
      lastDecay: lastDecay.toNumber()
    }
  }

  private valueOf(amount: u64, payoutTokenDecimals: number, depositTokenDecimals: number): u64 {
    return amount
      .mul(new u64(Math.pow(10, payoutTokenDecimals)))
      .div(new u64(Math.pow(10, depositTokenDecimals)));
  }

  private debtRatio(totalDebt: u64, tokenSupply: u64, payoutTokenDecimals: number): u64 {
    return totalDebt
      .mul(new u64(Math.pow(10, payoutTokenDecimals)))
      .div(tokenSupply);
  }

  private price(bondingInfo: BondingInfo, payoutTokenDecimals: number): u64 {
    const { totalDebt, bondingSupply, controlVariable, minPrice } = bondingInfo;
    const debtRatio = this.debtRatio(totalDebt, bondingSupply, payoutTokenDecimals);

    const price = debtRatio
      .mul(new u64(controlVariable))
      .div(new u64(Math.pow(10, payoutTokenDecimals - 5)));

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
    const bondingInfo = await this.getBondingInfo();

    const [bondingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(BONDING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const userDepositHolder = await deriveAssociatedTokenAddress(owner, bondingInfo.depositTokenMint);

    const { address: userPayoutHolder, ...resolveUserPayoutHolderInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        bondingInfo.payoutTokenMint,
        amount
      );

    const bondInstruction = this.program.instruction.bond(
      amount,
      new u64(1e12),
      {
        accounts: {
          bonding: this.config.address,
          bondingPda,
          depositTokenMint: bondingInfo.depositTokenMint,
          depositHolder: bondingInfo.depositHolder,
          payoutHolder: bondingInfo.payoutHolder,
          payoutTokenMint: bondingInfo.payoutTokenMint,
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

  // async purchaseToken(amount: u64): Promise<TransactionEnvelope> {

  //   const owner = this.program.provider.wallet?.publicKey;

  //   const [bondingInfo, vestConfigInfo] = await Promise.all([
  //     this.getBondingInfo(),
  //     this.getVestConfigInfo()
  //   ]);

  //   const [bondingPda] = await PublicKey.findProgramAddress(
  //     [Buffer.from(BONDING_SEED_PREFIX), this.config.address.toBuffer()],
  //     this.program.programId
  //   );

  //   const vestingAddr = await this.getUserVestingAddress();

  //   const [vSigner, vNonce] = await PublicKey.findProgramAddress(
  //     [Buffer.from(VESTING_SIGNER_SEED_PREFIX), vestingAddr.toBuffer()],
  //     this.program.programId
  //   );

  //   const [vestedHolder, userAssetHolder] = await Promise.all([
  //     deriveAssociatedTokenAddress(vSigner, vestConfigInfo.vestMint),
  //     deriveAssociatedTokenAddress(owner, bondingInfo.assetMint)
  //   ]);
   
  //   const { address: userVTokenHolder, ...resolveUserVTokenAccountInstrucitons } =
  //     await resolveOrCreateAssociatedTokenAddress(
  //       this.program.provider.connection,
  //       owner,
  //       vestConfigInfo.vestMint,
  //       amount
  //     );

  //   const instructions = [];

  //   const userVestingAddress = await this.getUserVestingAddress();
  //   const userVesting = await this.getVestingInfo(userVestingAddress);

  //   if (userVesting === null) {
  //     instructions.push(
  //       this.vestingProgram.instruction.initVesting(
  //         new u64(vNonce),
  //         {
  //           accounts: {
  //             vestConfig: this.config.vestConfig,
  //             vesting: vestingAddr,
  //             vestMint: vestConfigInfo.vestMint,
  //             vestedHolder: vestedHolder,
  //             vestingSigner: vSigner,
  //             payer: owner,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             clock: SYSVAR_CLOCK_PUBKEY,
  //             systemProgram: SystemProgram.programId,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //           }
  //         }
  //       )
  //     );
  //   }

  //   instructions.push(
  //     !!bondingInfo.lpInfo ?
  //       this.program.instruction.purchaseWithLiquidity(
  //         amount,
  //         new u64(1e10),
  //         {
  //           accounts: {
  //             bonding: this.config.address,
  //             bondingPda: bondingPda,
  //             assetMint: bondingInfo.assetMint,
  //             assetHolder: bondingInfo.assetHolder,
  //             vTokenHolder: bondingInfo.vTokenHolder,
  //             userAssetHolder,
  //             userVTokenHolder,
  //             owner,
  //             tokenAHolder: bondingInfo.lpInfo?.tokenAHolder,
  //             tokenBHolder: bondingInfo.lpInfo?.tokenBHolder,
  //             tokenProgram: TOKEN_PROGRAM_ID
  //           }
  //         }
  //       ) :
  //       this.program.instruction.purchaseWithStable(
  //         amount,
  //         new u64(1e10),
  //         {
  //           accounts: {
  //             bonding: this.config.address,
  //             bondingPda: bondingPda,
  //             assetMint: bondingInfo.assetMint,
  //             assetHolder: bondingInfo.assetHolder,
  //             vTokenHolder: bondingInfo.vTokenHolder,
  //             userAssetHolder,
  //             userVTokenHolder,
  //             owner,
  //             tokenProgram: TOKEN_PROGRAM_ID
  //           }
  //         }
  //       )
  //   );

  //   return new TransactionEnvelope(
  //     this.program.provider as any,
  //     [
  //       ...resolveUserVTokenAccountInstrucitons.instructions,
  //       ...instructions
  //     ],
  //     [
  //       ...resolveUserVTokenAccountInstrucitons.signers
  //     ]
  //   );

  // }

  
}