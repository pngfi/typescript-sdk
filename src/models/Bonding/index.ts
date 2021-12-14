import type { Provider } from '@saberhq/solana-contrib';

import { 
  BondingConfig, 
  BondingInfo,
  VestConfigInfo
} from '../../types';

import {
  PNG_BONDING_ID,
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

import { Idl, Program } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';

const BONDING_SEED_PREFIX = 'bonding_authority';

const VESTING_SEED_PREFIX = 'vesting';
const VESTING_AUTHORITY_SEED_PREFIX = 'vesting_authority';

export class Bonding {
  public config: BondingConfig;
  private program: Program;

  constructor(provider: Provider, config: BondingConfig) {
    this.config = config;
    this.program = new Program(idl as Idl, PNG_BONDING_ID, provider as any);
  }

  async getUserVestingAddress(): Promise<PublicKey> {
    const owner = this.program.provider.wallet?.publicKey || PublicKey.default;
    const [userVestingAddr] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SEED_PREFIX), this.config.addr.toBuffer(), owner.toBuffer()],
      this.program.programId
    );

    return userVestingAddr;
  }

  async getUserVesting() {
    const userVestingAddr = await this.getUserVestingAddress();

    try {
      const vesting = await this.program.account.vesting.fetch(userVestingAddr);

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
      lpInfo,
      vestConfig,
      lastDecay,
      decayFactor,
      controlVariable,
      totalDebt,
      bondingSupply
    } = await this.program.account.bonding.fetch(this.config.addr);

    const assetHolderInfo = await getTokenAccountInfo(this.program.provider as any, assetHolder);

    return {
      address: this.config.addr,
      assetMint,
      assetMintDecimals: tokenMintDecimals,
      assetHolder,
      lpInfo,
      vestConfig: {
        vestMint: vestConfig.vestMint,
        claimAllDuration: vestConfig.claimAllDuration.toNumber(),
        halfLifeDuration: vestConfig.halfLifeDuration.toNumber(),
        claimableHolder: vestConfig.claimableHolder,
        claimableMint: vestConfig.claimableMint
      },
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
    const { vestConfig, assetMint, lpInfo } = bondingInfo;

    const [vTokenMintInfo, assetMintInfo, tokenAHolderInfo, tokenBHolderInfo] = await Promise.all([
      getTokenMintInfo(this.program.provider as any, vestConfig.vestMint),
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

  async purchaseToken(amount: u64): Promise<TransactionEnvelope> {

    const owner = this.program.provider.wallet?.publicKey;

    const bondingInfo = await this.getBondingInfo();

    const [bondingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(BONDING_SEED_PREFIX), this.config.addr.toBuffer()],
      this.program.programId
    );

    const vestingAddr = await this.getUserVestingAddress();

    const [vSigner, vNonce] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_AUTHORITY_SEED_PREFIX), vestingAddr.toBuffer()],
      this.program.programId
    );

    const vestedHolder = await deriveAssociatedTokenAddress(vSigner, bondingInfo.vestConfig.vestMint);
    const userAssetHolder = await deriveAssociatedTokenAddress(owner, bondingInfo.assetMint);

    const { address: userVTokenHolder, ...resolveUserVTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        bondingInfo.vestConfig.vestMint,
        amount
      );
    
    const instructions = [];
    const userVesting = await this.getUserVesting();
    
    if (userVesting === null) {
      instructions.push(
        this.program.instruction.initVesting(
          new u64(vNonce),
          {
            accounts: {
              bonding: this.config.addr,
              vesting: vestingAddr,
              vestMint: bondingInfo.vestConfig.vestMint,
              vestedHolder: vestedHolder,
              vestingSigner: vSigner,
              payer: owner,
              rent: SYSVAR_RENT_PUBKEY,
              clock: SYSVAR_CLOCK_PUBKEY,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            }
          }
        )
      );
    } else {
      instructions.push(
        this.program.instruction.updateVesting(
          {
            accounts: {
              bonding: this.config.addr,
              vesting: vestingAddr,
              vestedHolder: vestedHolder,
              vestMint: bondingInfo.vestConfig.vestMint,
              vestSigner: vSigner,
              owner,
              clock: SYSVAR_CLOCK_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
            }
          }
        )
      );
    }

    instructions.push(
      !!bondingInfo.lpInfo ?
      this.program.instruction.purchaseWithLiquidity(
        amount,
        new u64(1e10),
        {
          accounts: {
            bonding: this.config.addr,
            bondingPda: bondingPda,
            assetMint: bondingInfo.assetMint,
            assetHolder: bondingInfo.assetHolder,
            userAssetHolder: userAssetHolder,
            tokenAHolder: bondingInfo.lpInfo?.tokenAHolder,
            tokenBHolder: bondingInfo.lpInfo?.tokenBHolder,
            vesting: vestingAddr,
            vestMint: bondingInfo.vestConfig.vestMint,
            vestedHolder,
            vestSigner: vSigner,
            owner,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          }
        }
      ) : 
      this.program.instruction.purchaseWithStable(
        amount,
        new u64(1e10),
        {
          accounts: {
            bonding: this.config.addr,
            bondingPda: bondingPda,
            assetMint: bondingInfo.assetMint,
            assetHolder: bondingInfo.assetHolder,
            userAssetHolder: userAssetHolder,
            vesting: vestingAddr,
            vestMint: bondingInfo.vestConfig.vestMint,
            vestedHolder,
            vestSigner: vSigner,
            owner,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          }
        }
      )
    );

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...resolveUserVTokenAccountInstrucitons.instructions,
        ...instructions
      ],
      [
        ...resolveUserVTokenAccountInstrucitons.signers
      ]
    );

  }

  async claimVestedToken(tokenMint: PublicKey): Promise<TransactionEnvelope> {
    const bondingInfo = await this.getBondingInfo();

    const owner = this.program.provider.wallet?.publicKey;

    const vestingAddr = await this.getUserVestingAddress();

    const [vSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_AUTHORITY_SEED_PREFIX), vestingAddr.toBuffer()],
      this.program.programId
    );

    const [bondingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(BONDING_SEED_PREFIX), this.config.addr.toBuffer()],
      this.program.programId
    );

    const vestedHolder = await deriveAssociatedTokenAddress(vSigner, bondingInfo.vestConfig.vestMint);

    const claimableHolder = await deriveAssociatedTokenAddress(
      bondingPda,
      tokenMint
    );

    const { address: userTokenHolder, ...resolveUserTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        tokenMint
      );

    // const updateInstruction = this.program.instruction.update({
    //   accounts: {
    //     vestConfig: this.config.vestConfig,
    //     vesting: vestingAddr,
    //     vestedHolder,
    //     vestMint: bondingInfo.vTokenMint,
    //     vestingSigner: vSigner,
    //     owner,
    //     clock: SYSVAR_CLOCK_PUBKEY,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //   }
    // });

    const claimInstruction = this.program.instruction.claim({
      accounts: {
        bonding: this.config.addr,
        bondingPda: bondingPda,
        claimableHolder: claimableHolder,
        vesting: vestingAddr,
        vestedHolder: vestedHolder,
        vestMint: bondingInfo.vestConfig.vestMint,
        vestSigner: vSigner,
        userClaimableHolder: userTokenHolder,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
    });

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...resolveUserTokenAccountInstrucitons.instructions,
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