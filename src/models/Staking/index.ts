import type { Provider } from '@saberhq/solana-contrib';

import { StakingConfig } from '../../types';

import {
  DecimalUtil,
  ZERO_U64,
  PNG_STAKING_ID,
  PNG_VESTING_ID,
  deriveAssociatedTokenAddress,
  resolveOrCreateAssociatedTokenAddress,
} from '../../utils';

import {
  u64,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import {
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram
} from '@solana/web3.js';

import idl from './idl.json';
import vestingIdl from './vesting.json';

import { Idl, Program } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';

const STAKING_SEED_PREFIX = 'staking_authority';

const VESTING_SEED_PREFIX = 'vesting';
const VESTING_SIGNER_SEED_PREFIX = 'vesting_signer';
const VESTING_CONFIG_SIGNER_SEED_PREFIX = 'vest_config_signer';
const REWARDS_SEED_PREFIX = "rewards_authority";

export class Staking {
  public config: StakingConfig;
  private program: Program;
  private vestingProgram: Program;
  private stakingInfo: any;

  constructor(provider: Provider, config: StakingConfig, stakingInfo: any) {
    this.config = config;
    this.program = new Program(idl as Idl, PNG_STAKING_ID, provider as any);
    this.vestingProgram = new Program(vestingIdl as Idl, PNG_VESTING_ID, provider as any);
    this.stakingInfo = stakingInfo;
  }

  async toVToken(amount: u64): Promise<TransactionEnvelope> {

    const owner = this.vestingProgram.provider.wallet?.publicKey;
    const vestConfigInfo = this.stakingInfo.vestConfigInfo;

    const [vcSigner, _] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_CONFIG_SIGNER_SEED_PREFIX), this.config.vestConfig.toBuffer()],
      this.vestingProgram.programId
    );

    const [claimableHolder, userTokenAccount] = await Promise.all([
      deriveAssociatedTokenAddress(vcSigner, vestConfigInfo.claimableMint),
      deriveAssociatedTokenAddress(owner, vestConfigInfo.claimableMint)
    ]);

    const { address: userVTokenAccount, ...resolveUserVTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.vestingProgram.provider.connection,
        owner,
        vestConfigInfo.vestMint,
        amount
      );

    const instruction = this.vestingProgram.instruction.stake(amount, {
      accounts: {
        vestConfig: this.config.vestConfig,
        vestConfigSigner: vcSigner,
        vestMint: vestConfigInfo.vestMint,
        claimableHolder,
        userClaimableHolder: userTokenAccount,
        userVestHolder: userVTokenAccount,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });

    return new TransactionEnvelope(
      this.vestingProgram.provider as any,
      [
        ...resolveUserVTokenAccountInstrucitons.instructions,
        instruction
      ],
      [
        ...resolveUserVTokenAccountInstrucitons.signers
      ]
    );
  }

  async vestAll(userVestingInfo: any): Promise<TransactionEnvelope> {

    const owner = this.program.provider.wallet?.publicKey;

    const instructions = [];

    const vestConfigInfo = this.stakingInfo.vestConfigInfo;
    
    const [userVestingAddress] = userVestingInfo ? [new PublicKey(userVestingInfo.pubkey)] : await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SEED_PREFIX), new PublicKey(this.config.vestConfig).toBuffer(), new PublicKey(owner).toBuffer()],
      new PublicKey(this.vestingProgram.programId)
    );

    const [vSigner, vNonce] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), userVestingAddress.toBuffer()],
      this.vestingProgram.programId
    );

    const [vestedHolder, userVestHolder] = await Promise.all([
      deriveAssociatedTokenAddress(vSigner, vestConfigInfo.vestMint),
      deriveAssociatedTokenAddress(owner, vestConfigInfo.vestMint)
    ]);

    // if user not have vesting, init it.
    if (!!!userVestingInfo) {
      instructions.push(
        this.vestingProgram.instruction.initVesting(
          new u64(vNonce),
          {
            accounts: {
              vestConfig: this.config.vestConfig,
              vesting: userVestingAddress,
              vestMint: vestConfigInfo.vestMint,
              vestedHolder,
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
    }

    // // update vest
    instructions.push(
      this.vestingProgram.instruction.update({
        accounts: {
          vestConfig: this.config.vestConfig,
          vesting: userVestingAddress,
          vestedHolder,
          vestMint: vestConfigInfo.vestMint,
          vestingSigner: vSigner,
          owner,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      })
    );

    // vest all
    instructions.push(
      this.vestingProgram.instruction.vestAll({
        accounts: {
          vesting: userVestingAddress,
          vestedHolder,
          userVestHolder,
          owner,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      })
    );

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...instructions
      ],
      []
    );
  }

  async stake(amount: u64): Promise<TransactionEnvelope> {

    const [stakingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const stakedHolder = await deriveAssociatedTokenAddress(stakingPda, this.stakingInfo.tokenMint);
    const userTokenHolder = await deriveAssociatedTokenAddress(owner, this.stakingInfo.tokenMint);
    const { address: userSTokenHolder, ...resolveUserSTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        this.stakingInfo.sTokenMint
      );

    const stakeInstruction = this.program.instruction.stake(amount, {
      accounts: {
        staking: this.config.address,
        stakingPda,
        stakeTokenMint: this.stakingInfo.sTokenMint,
        tokenHolder: stakedHolder,
        userTokenHolder,
        userStakeTokenHolder: userSTokenHolder,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...resolveUserSTokenAccountInstrucitons.instructions,
        stakeInstruction
      ],
      [
        ...resolveUserSTokenAccountInstrucitons.signers
      ]
    );
  }

  async stakeAll(): Promise<TransactionEnvelope> {

    const [stakingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const tokenHolder = await deriveAssociatedTokenAddress(stakingPda, this.stakingInfo.tokenMint);
    const userTokenHolder = await deriveAssociatedTokenAddress(owner, this.stakingInfo.tokenMint);
    const { address: userStakeTokenHolder, ...resolveUserSTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        this.stakingInfo.sTokenMint
      );

    const stakeInstruction = this.program.instruction.stakeAll({
      accounts: {
        staking: this.config.address,
        stakingPda,
        stakeTokenMint: this.stakingInfo.sTokenMint,
        tokenHolder,
        userTokenHolder,
        userStakeTokenHolder,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        ...resolveUserSTokenAccountInstrucitons.instructions,
        stakeInstruction
      ],
      [
        ...resolveUserSTokenAccountInstrucitons.signers
      ]
    );
  }

  async unvestAll(userVestingInfo: any): Promise<TransactionEnvelope> {
    const vestingAddr = userVestingInfo.pubkey;

    const [vSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), vestingAddr.toBuffer()],
      this.vestingProgram.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const vestConfigInfo = this.stakingInfo.vestConfigInfo;

    const [vestedHolder, userVestHolder] = await Promise.all([
      deriveAssociatedTokenAddress(vSigner, vestConfigInfo.vestMint),
      deriveAssociatedTokenAddress(owner, vestConfigInfo.vestMint),
    ]);

    const updateInstruction = this.vestingProgram.instruction.update({
      accounts: {
        vestConfig: this.config.vestConfig,
        vesting: vestingAddr,
        vestedHolder,
        vestMint: vestConfigInfo.vestMint,
        vestingSigner: vSigner,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID
      }
    });

    const unvestInstruction = this.vestingProgram.instruction.unvestAll({
      accounts: {
        vestedHolder,
        vesting: vestingAddr,
        vestingSigner: vSigner,
        userVestHolder,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
    });

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        updateInstruction,
        unvestInstruction
      ],
      []
    );

  }

  async unstake(amount: u64): Promise<TransactionEnvelope> {

    const [stakingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const [stakedHolder, userTokenHolder, userSTokenHolder] = await Promise.all([
      deriveAssociatedTokenAddress(stakingPda, this.stakingInfo.tokenMint),
      deriveAssociatedTokenAddress(owner, this.stakingInfo.tokenMint),
      deriveAssociatedTokenAddress(owner, this.stakingInfo.sTokenMint)
    ]);

    const unstakeInstruction = this.program.instruction.unstake(amount, {
      accounts: {
        staking: this.config.address,
        stakingPda,
        stakeTokenMint: this.stakingInfo.sTokenMint,
        tokenHolder: stakedHolder,
        userTokenHolder,
        userStakeTokenHolder: userSTokenHolder,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });

    return new TransactionEnvelope(
      this.program.provider as any,
      [
        unstakeInstruction
      ],
      []
    );
  }

  async claimVestedToken(tokenMint: PublicKey, userVestingInfo: any): Promise<TransactionEnvelope> {

    const owner = this.program.provider.wallet?.publicKey;

    const vestConfigInfo = this.stakingInfo.vestConfigInfo;
    const userVestingAddress = userVestingInfo.pubkey;

    const [vcSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_CONFIG_SIGNER_SEED_PREFIX), this.config.vestConfig.toBuffer()],
      this.vestingProgram.programId
    );

    const [vSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), userVestingAddress.toBuffer()],
      this.vestingProgram.programId
    );

    const [claimableHolder, vestedHolder] = await Promise.all([
      deriveAssociatedTokenAddress(vcSigner, tokenMint),
      deriveAssociatedTokenAddress(vSigner, vestConfigInfo.vestMint)
    ]);

    const { address: userTokenHolder, ...resolveUserTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.vestingProgram.provider.connection,
        owner,
        tokenMint
      );

    const updateInstruction = this.vestingProgram.instruction.update({
      accounts: {
        vestConfig: this.config.vestConfig,
        vesting: userVestingAddress,
        vestedHolder,
        vestMint: vestConfigInfo.vestMint,
        vestingSigner: vSigner,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID
      }
    });

    const claimInstruction = this.vestingProgram.instruction.claim({
      accounts: {
        vestConfig: this.config.vestConfig,
        vestConfigSigner: vcSigner,
        claimableHolder,
        vesting: userVestingAddress,
        userClaimableHolder: userTokenHolder,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      instructions: [updateInstruction]
    });

    return new TransactionEnvelope(
      this.vestingProgram.provider as any,
      [
        ...resolveUserTokenAccountInstrucitons.instructions,
        updateInstruction,
        claimInstruction
      ],
      [
        ...resolveUserTokenAccountInstrucitons.signers
      ]
    );
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

  async rebase(): Promise<TransactionEnvelope> {

    const [rewardsPda] = await PublicKey.findProgramAddress(
      [Buffer.from(REWARDS_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const rebaseInstruction = this.program.instruction.rebase(
      {
        accounts: {
          staking: this.config.address,
          rewardsPda,
          rewardsHolder: this.stakingInfo.rewardsHolder,
          tokenHolder: this.stakingInfo.tokenHolder,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    );

    return new TransactionEnvelope(
      this.program.provider as any,
      [rebaseInstruction],
      []
    );
  }

}