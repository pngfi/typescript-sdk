import type { Provider } from '@saberhq/solana-contrib';

import { 
  BondingConfig, 
  BondingInfo,
  VestConfigInfo
} from '../../types';

import {
  PNG_BONDING_ID,
  PNG_VESTING_ID,
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
import vestingIdl from './vesting_idl.json';

import { Idl, Program } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';

const BONDING_SEED_PREFIX = 'bonding_authority';

const VESTING_SEED_PREFIX = 'vesting';
const VESTING_SIGNER_SEED_PREFIX = 'vesting_signer';
const VESTING_CONFIG_SIGNER_SEED_PREFIX = 'vest_config_signer';

export class Bonding {
  public config: BondingConfig;
  private program: Program;
  private vestingProgram: Program;

  constructor(provider: Provider, config: BondingConfig) {
    this.config = config;
    this.program = new Program(idl as Idl, PNG_BONDING_ID, provider as any);
    this.vestingProgram = new Program(vestingIdl as Idl, PNG_VESTING_ID, provider as any);
  }

  async getVestConfigInfo(): Promise<VestConfigInfo | null> {
    try {
   
      const {
        vestMint,
        claimAllDuration,
        halfLifeDuration,
        claimableHolder,
        claimableMint
      } = await this.vestingProgram.account.vestConfig.fetch(this.config.vestConfig);

      return {
        vestMint,
        claimAllDuration: claimAllDuration.toNumber(),
        halfLifeDuration: halfLifeDuration.toNumber(),
        claimableHolder,
        claimableMint
      }
    } catch (err) {
      return null;
    }
  }

  async getUserVesting(user: PublicKey) {
    const [userVestingAddr] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SEED_PREFIX), this.config.vestConfig.toBuffer(), user.toBuffer()],
      this.vestingProgram.programId
    );

    try {
      const vesting = await this.vestingProgram.account.vesting.fetch(userVestingAddr);

      return vesting;
    } catch (err) {
      return null;
    }
  }

  async getBondingInfo(): Promise<BondingInfo> {
    const {
      assetMint,
      tokenMintDecimals,
      assetHolder,
      vTokenHolder,
      lpInfo,
      lastDecay,
      decayFactor,
      controlVariable,
      totalDebt,
      bondingSupply
    } = await this.program.account.bonding.fetch(this.config.addr);

    const [assetHolderInfo, vTokenHolderInfo] = await Promise.all([
      getTokenAccountInfo(this.program.provider as any, assetHolder),
      getTokenAccountInfo(this.program.provider as any, vTokenHolder)
    ]);

    return {
      address: this.config.addr,
      assetMint,
      assetMintDecimals: tokenMintDecimals,
      assetHolder,
      vTokenHolder,
      vTokenMint: vTokenHolderInfo?.mint || PublicKey.default,
      lpInfo,
      assetHolderAmount: assetHolderInfo ? DecimalUtil.fromU64(assetHolderInfo.amount) : ZERO_DECIMAL,
      lastDecay: lastDecay.toNumber(),
      decayFactor: decayFactor.toNumber(),
      controlVariable: controlVariable.toNumber(),
      totalDebt,
      bondingSupply
    }
  }

  private decay(bondingInfo: BondingInfo): u64 {
    const { lastDecay, totalDebt, decayFactor } = bondingInfo;

    const duration = Math.floor(new Date().getTime() / 1000 - lastDecay);
    const decay = totalDebt.mul(new u64(duration)).div(new u64(decayFactor));
   
    return decay.gt(totalDebt) ? totalDebt : decay;
  }

  private async valuation(bondingInfo: BondingInfo, amount: u64): Promise<u64> {
    const { vTokenMint, assetMint, lpInfo } = bondingInfo;

    const [vTokenMintInfo, assetMintInfo, tokenAHolderInfo, tokenBHolderInfo] = await Promise.all([
      getTokenMintInfo(this.program.provider as any, vTokenMint),
      getTokenMintInfo(this.program.provider as any, assetMint),
      lpInfo ? getTokenAccountInfo(this.program.provider as any, lpInfo.tokenAHolder) : Promise.resolve(null),
      lpInfo ? getTokenAccountInfo(this.program.provider as any, lpInfo.tokenBHolder) : Promise.resolve(null),
    ]);

    if (!lpInfo) {
      return amount.mul(new u64(Math.pow(10, vTokenMintInfo.decimals)))
        .div(new u64(Math.pow(10, assetMintInfo.decimals)));
    } else {
      const { tokenADecimals, tokenBDecimals } = lpInfo;

      const decimals = tokenADecimals + tokenBDecimals - assetMintInfo.decimals;
      const tokenAAmount = tokenAHolderInfo?.amount || ZERO_U64;
      const tokenBAmount = tokenBHolderInfo?.amount || ZERO_U64;

      const kValue = tokenAAmount.mul(tokenBAmount).div(new u64(Math.pow(10, decimals)));
    
      const totalValue = DecimalUtil.fromU64(kValue).sqrt().mul(2);

      return DecimalUtil.toU64(totalValue, assetMintInfo.decimals)
        .mul(amount)
        .div(new u64(Math.pow(10, assetMintInfo.decimals)))
        .div(assetMintInfo.supply);
    }

  }

  async calcPayout(amount: u64): Promise<u64> {
    const bondingInfo = await this.getBondingInfo();
    const { totalDebt, bondingSupply, controlVariable } = bondingInfo;

    const debtRatio =
      totalDebt
        .sub(this.decay(bondingInfo))
        .mul(new u64(1e9))
        .div(bondingSupply);

    const price =
      debtRatio
        .mul(new u64(controlVariable))
        .add(new u64(1e9))
        .div(new u64(1e7))
        .toNumber();

    const valuation = await this.valuation(bondingInfo, amount);

    return valuation.mul(new u64(100)).div(new u64(price));
  }

  async purchaseLPToken(amount: u64): Promise<TransactionEnvelope> {
    const bondingInfo = await this.getBondingInfo();

    const [bondingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(BONDING_SEED_PREFIX), this.config.addr.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    // Resolve or create asset user account;
    const userAssetHolder = await deriveAssociatedTokenAddress(owner, bondingInfo.assetMint);

    const { address: userVTokenHolder, ...resolveUserVTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        bondingInfo.vTokenMint,
        amount
      );

    const purchaseInstruction = this.program.instruction.purchaseWithLiquidity(
      amount,
      new u64(1e10),
      {
        accounts: {
          bonding: this.config.addr,
          bondingPda: bondingPda,
          assetMint: bondingInfo.assetMint,
          assetHolder: bondingInfo.assetHolder,
          vTokenHolder: bondingInfo.vTokenHolder,
          userAssetHolder: userAssetHolder,
          userVTokenHolder: userVTokenHolder,
          owner,
          tokenAHolder: bondingInfo.lpInfo?.tokenAHolder,
          tokenBHolder: bondingInfo.lpInfo?.tokenBHolder,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      }
    );

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...resolveUserVTokenAccountInstrucitons.instructions,
        purchaseInstruction
      ],
      [
        ...resolveUserVTokenAccountInstrucitons.signers
      ]
    );

  }

  async vestVToken(amount: u64): Promise<TransactionEnvelope> {

    const bondingInfo = await this.getBondingInfo();

    const owner = this.program.provider.wallet?.publicKey;
    const vestingInstructions = [];

    const [vestingAddr] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SEED_PREFIX), this.config.vestConfig.toBuffer(), owner.toBuffer()],
      this.vestingProgram.programId
    );

    const vestingAccountInfo = await this.program.provider.connection.getAccountInfo(vestingAddr);

    const [vSigner, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), vestingAddr.toBuffer()],
      this.vestingProgram.programId
    );

    const vestedHolder = await deriveAssociatedTokenAddress(vSigner, bondingInfo.vTokenMint);
    const userVTokenHolder = await deriveAssociatedTokenAddress(owner, bondingInfo.vTokenMint);

    if (!vestingAccountInfo) {
      vestingInstructions.push(this.vestingProgram.instruction.initVesting(nonce, {
        accounts: {
          vestConfig: this.config.vestConfig,
          vesting: vestingAddr,
          vestMint: bondingInfo.vTokenMint,
          vestedHolder,
          vestingSigner: vSigner,
          payer: owner,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }
      }));
    }

    vestingInstructions.push(this.vestingProgram.instruction.update({
      accounts: {
        vestConfig: this.config.vestConfig,
        vesting: vestingAddr,
        vestedHolder,
        vestMint: bondingInfo.vTokenMint,
        vestingSigner: vSigner,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
    }));

    vestingInstructions.push(this.vestingProgram.instruction.vest(
      amount,
      {
        accounts: {
          vesting: vestingAddr,
          vestedHolder,
          userVestHolder: userVTokenHolder,
          owner,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      }
    ));

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...vestingInstructions
      ],
      []
    );

  }

  async claimVestedToken(tokenMint: PublicKey): Promise<TransactionEnvelope> {
    const bondingInfo = await this.getBondingInfo();

    const owner = this.program.provider.wallet?.publicKey;

    const [vestingAddr] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SEED_PREFIX), this.config.vestConfig.toBuffer(), owner.toBuffer()],
      this.vestingProgram.programId
    );

    const [vSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), vestingAddr.toBuffer()],
      this.vestingProgram.programId
    );

    const [vcSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_CONFIG_SIGNER_SEED_PREFIX), this.config.vestConfig.toBuffer()],
      this.vestingProgram.programId
    );

    const vestedHolder = await deriveAssociatedTokenAddress(vSigner, bondingInfo.vTokenMint);

    const claimableHolder = await deriveAssociatedTokenAddress(
      vcSigner,
      tokenMint
    );

    const { address: userTokenHolder, ...resolveUserTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        tokenMint
      );

    const updateInstruction = this.vestingProgram.instruction.update({
      accounts: {
        vestConfig: this.config.vestConfig,
        vesting: vestingAddr,
        vestedHolder,
        vestMint: bondingInfo.vTokenMint,
        vestingSigner: vSigner,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
    });

    const claimInstruction = this.vestingProgram.instruction.claim({
      accounts: {
        vestConfig: this.config.vestConfig,
        vestConfigSigner: vcSigner,
        claimableHolder,
        vesting: vestingAddr,
        userClaimableHolder: userTokenHolder,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      instructions: [updateInstruction],
    });

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...resolveUserTokenAccountInstrucitons.instructions,
        updateInstruction,
        claimInstruction
      ],
      [
        ...resolveUserTokenAccountInstrucitons.signers
      ]
    )
  }

  static estimatedVestingClaimable(
    halfLifeDuration: number,
    claimAllDuration: number,
    vestedHolderAmount: u64,
    lastUpdatedTime: number,
    lastVestTime: number,
    claimableAmount: u64,
    updateTime: number //in seconds
  ): u64 {
  
    if (updateTime <= lastUpdatedTime) {
      throw Error('update time should gt lastUpdateTime');
    }
  
    //no more vested amount
    if (vestedHolderAmount.lte(ZERO_U64)) {
      return claimableAmount;
    }
  
    // claimed all
    if (updateTime - lastVestTime > claimAllDuration) {
      return claimableAmount.add(vestedHolderAmount);
    }
  
    const timeElapsed = updateTime - lastUpdatedTime;
  
    const newRemainedAmount = 
      DecimalUtil.fromU64(vestedHolderAmount)
        .mul(
          DecimalUtil.fromNumber(Math.exp((-Math.LN2 * timeElapsed) / halfLifeDuration))
        );
  
    const newClaimableAmount = DecimalUtil.fromU64(vestedHolderAmount).sub(newRemainedAmount);
  
    return claimableAmount.add(DecimalUtil.toU64(newClaimableAmount));
  }

}