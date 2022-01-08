import type { Provider } from '@saberhq/solana-contrib';

import {
  StakingInfo,
  StakingConfig,
  VestConfigInfo
} from '../../types';

import {
  DecimalUtil,
  ZERO_U64,
  PNG_STAKING_ID,
  PNG_VESTING_ID,
  getTokenAccountInfo,
  deriveAssociatedTokenAddress,
  resolveOrCreateAssociatedTokenAddress,
  transferToken,
  getTokenMintInfo
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

  constructor(provider: Provider, config: StakingConfig) {
    this.config = config;
    this.program = new Program(idl as Idl, PNG_STAKING_ID, provider as any);
    this.vestingProgram = new Program(vestingIdl as Idl, PNG_VESTING_ID, provider as any);
  }

  async getUserVestingAddress(): Promise<PublicKey> {
    const owner = this.program.provider.wallet?.publicKey || PublicKey.default;
    const [userVestingAddr] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SEED_PREFIX), this.config.vestConfig.toBuffer(), owner.toBuffer()],
      this.vestingProgram.programId
    );

    return userVestingAddr;
  }

  async getVestingInfo(addr: PublicKey) {

    try {
      const vesting = await this.vestingProgram.account.vesting.fetch(addr);

      return vesting;
    } catch (err) {
      return null;
    }
  }

  async getVestConfigInfo(): Promise<VestConfigInfo> {
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
  }

  async getStakingInfo(): Promise<StakingInfo> {
    const {
      tokenMint,
      stakeTokenMint,
      tokenHolder,
      rebaseEpochDuration,
      rebaseLastTime,
      rebaseRateNumerator,
      rebaseRateDenominator,
      rewardsHolder,
      rebaseSupply,
      rebaseRewardsAmount
    } = await this.program.account.staking.fetch(this.config.address);

    // console.log('staking', await this.program.account.staking.fetch(this.config.address))

    const tokenHolderInfo = await getTokenAccountInfo(this.program.provider as any, tokenHolder);
    const stokenHolderInfo = await getTokenMintInfo(this.program.provider as any, stakeTokenMint);

    return {
      tokenMint,
      sTokenMint: stakeTokenMint,
      tokenHolder,
      payoutTokenMint: this.config.payoutAsset,
      tokenHolderAmount: tokenHolderInfo?.amount || ZERO_U64,
      rebaseEpochDuration: rebaseEpochDuration.toNumber(),
      rebaseLastTime: rebaseLastTime.toNumber(),
      rebaseRateNumerator: rebaseRateNumerator.toNumber(),
      rebaseRateDenominator: rebaseRateDenominator.toNumber(),
      rewardsHolder,
      rebaseSupply,
      sTokenMintSupply: stokenHolderInfo?.supply,
      rebaseRewardsAmount
    }
  }

  async toVToken(amount: u64): Promise<TransactionEnvelope> {

    const owner = this.vestingProgram.provider.wallet?.publicKey;
    const vestConfigInfo = await this.getVestConfigInfo();

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

  async vestAll(): Promise<TransactionEnvelope> {

    const owner = this.program.provider.wallet?.publicKey;

    const instructions = [];

    const [userVestingAddress, vestConfigInfo] = await Promise.all([
      this.getUserVestingAddress(),
      this.getVestConfigInfo()
    ]);

    const userVestingInfo = await this.getVestingInfo(userVestingAddress);
    const [vSigner, vNonce] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), userVestingAddress.toBuffer()],
      this.vestingProgram.programId
    );

    const [vestedHolder, userVestHolder] = await Promise.all([
      deriveAssociatedTokenAddress(vSigner, vestConfigInfo.vestMint),
      deriveAssociatedTokenAddress(owner, vestConfigInfo.vestMint)
    ]);

    // if user not have vesting, init it.
    if (userVestingInfo === null) {
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

    // upodate vest
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
    const stakingInfo = await this.getStakingInfo();

    const [stakingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const stakedHolder = await deriveAssociatedTokenAddress(stakingPda, stakingInfo.tokenMint);
    const userTokenHolder = await deriveAssociatedTokenAddress(owner, stakingInfo.tokenMint);
    const { address: userSTokenHolder, ...resolveUserSTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        stakingInfo.sTokenMint
      );

    const stakeInstruction = this.program.instruction.stake(amount, {
      accounts: {
        staking: this.config.address,
        stakingPda,
        stakeTokenMint: stakingInfo.sTokenMint,
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
    const stakingInfo = await this.getStakingInfo();

    const [stakingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const tokenHolder = await deriveAssociatedTokenAddress(stakingPda, stakingInfo.tokenMint);
    const userTokenHolder = await deriveAssociatedTokenAddress(owner, stakingInfo.tokenMint);
    const { address: userStakeTokenHolder, ...resolveUserSTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        stakingInfo.sTokenMint
      );

    const stakeInstruction = this.program.instruction.stakeAll({
      accounts: {
        staking: this.config.address,
        stakingPda,
        stakeTokenMint: stakingInfo.sTokenMint,
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

  async unvestAll(): Promise<TransactionEnvelope> {
    const vestingAddr = await this.getUserVestingAddress();
    const [vSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), vestingAddr.toBuffer()],
      this.vestingProgram.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const vestConfigInfo = await this.getVestConfigInfo();

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
    const stakeConfigInfo = await this.getStakingInfo();

    const [stakingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const [stakedHolder, userTokenHolder, userSTokenHolder] = await Promise.all([
      deriveAssociatedTokenAddress(stakingPda, stakeConfigInfo.tokenMint),
      deriveAssociatedTokenAddress(owner, stakeConfigInfo.tokenMint),
      deriveAssociatedTokenAddress(owner, stakeConfigInfo.sTokenMint)
    ]);

    const unstakeInstruction = this.program.instruction.unstake(amount, {
      accounts: {
        staking: this.config.address,
        stakingPda,
        stakeTokenMint: stakeConfigInfo.sTokenMint,
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

  async claimVestedToken(tokenMint: PublicKey): Promise<TransactionEnvelope> {

    const owner = this.program.provider.wallet?.publicKey;

    const [vestingAddr, vestConfigInfo] = await Promise.all([
      this.getUserVestingAddress(),
      this.getVestConfigInfo()
    ]);

    const [vcSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_CONFIG_SIGNER_SEED_PREFIX), this.config.vestConfig.toBuffer()],
      this.vestingProgram.programId
    );

    const [vSigner] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_SIGNER_SEED_PREFIX), vestingAddr.toBuffer()],
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
        vesting: vestingAddr,
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
        vesting: vestingAddr,
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

  /* async vestStake(amount: u64): Promise<TransactionEnvelope> {

    const owner = this.program.provider.wallet?.publicKey;

    const vestConfig = await this.getVestConfigInfo();

    const [vestingPda, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from(VESTING_CONFIG_SIGNER_SEED_PREFIX), this.config.vestConfig.toBuffer()],
      this.vestingProgram.programId
    );

    const userClaimableHolder = await deriveAssociatedTokenAddress(
      owner,
      vestConfig.claimableMint
    );
    const userVestHolder = await deriveAssociatedTokenAddress(
      owner,
      vestConfig.vestMint
    );

    const vestStakeInstruction = this.vestingProgram.instruction.stake(
      amount,
      {
        accounts: {
          vestConfig: this.config.vestConfig,
          vestConfigSigner: vestingPda,
          vestMint: vestConfig?.vestMint,

          claimableHolder: vestConfig?.claimableHolder,
          userClaimableHolder: userClaimableHolder,
          userVestHolder: userVestHolder,

          owner,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    )

    return new TransactionEnvelope(
      this.vestingProgram.provider as any,
      [
        vestStakeInstruction
      ],
      []
    )
  }

  async transferToken(
    tokenMint: PublicKey,
    destination: PublicKey,
    amount: u64,
  ): Promise<TransactionEnvelope> {
    const payer = this.program.provider.wallet?.publicKey;

    const source = await deriveAssociatedTokenAddress(
      payer,
      tokenMint
    );

    const instructions = await transferToken(
      source,
      destination,
      amount,
      payer
    );

    return new TransactionEnvelope(
      this.vestingProgram.provider as any,
      [
        ...instructions.instructions
      ],
      []
    )
  } */

  async rebase(): Promise<TransactionEnvelope> {
    const stakeConfigInfo = await this.getStakingInfo();

    const [rewardsPda] = await PublicKey.findProgramAddress(
      [Buffer.from(REWARDS_SEED_PREFIX), this.config.address.toBuffer()],
      this.program.programId
    );

    const rebaseInstruction = this.program.instruction.rebase(
      {
        accounts: {
          staking: this.config.address,
          rewardsPda,
          rewardsHolder: stakeConfigInfo.rewardsHolder,
          tokenHolder: stakeConfigInfo.tokenHolder,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    )

    return new TransactionEnvelope(
      this.program.provider as any,
      [rebaseInstruction],
      []
    )
  }

}