import type { Provider } from '@saberhq/solana-contrib';

import { 
  StakeConfigInfo
} from '../../types';

import {
  PNG_STAKING_ID,
  STAKING_CONFIG,
  deriveAssociatedTokenAddress,
  resolveOrCreateAssociatedTokenAddress
} from '../../utils';

import {
  u64,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

import { PublicKey } from '@solana/web3.js';

import idl from './idl.json';
import { Idl, Program } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';

const STAKING_SEED_PREFIX = 'staking_authority';

export class Staking {
  private program: Program;

  constructor(provider: Provider) {
    this.program = new Program(idl as Idl, PNG_STAKING_ID, provider as any);
  }

  async getStakeConfigInfo(): Promise<StakeConfigInfo> {
    const {
      tokenMint,
      stakeTokenMint,
      tokenHolder,
      rebaseEpochDuration,
      rebaseLastTime,
      rebaseRateNumerator,
      rebaseRateDenominator,
      rewardsHolder,
      rebaseSupply
    } = await this.program.account.staking.fetch(STAKING_CONFIG);
    
    return {
      tokenMint,
      sTokenMint: stakeTokenMint,
      tokenHolder,
      rebaseEpochDuration: rebaseEpochDuration.toNumber(),
      rebaseLastTime: rebaseLastTime.toNumber(),
      rebaseRateNumerator: rebaseRateNumerator.toNumber(),
      rebaseRateDenominator: rebaseRateDenominator.toNumber(),
      rewardsHolder,
      rebaseSupply
    }
  }

  async stake(amount: u64): Promise<TransactionEnvelope> {
    const stakeConfigInfo = await this.getStakeConfigInfo();

    const [authority] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), STAKING_CONFIG.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const stakedHolder = await deriveAssociatedTokenAddress(authority, stakeConfigInfo.tokenMint);
    const userTokenHolder = await deriveAssociatedTokenAddress(owner, stakeConfigInfo.tokenMint);
    const { address: userSTokenHolder, ...resolveUserSTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        stakeConfigInfo.sTokenMint
      );
    
    const stakeInstruction = this.program.instruction.stake(amount, {
      accounts: {
        staking: STAKING_CONFIG,
        authority: authority,
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
        ...resolveUserSTokenAccountInstrucitons.instructions,
        stakeInstruction
      ],
      [
        ...resolveUserSTokenAccountInstrucitons.signers
      ]
    );
  }

  async unstake(amount: u64): Promise<TransactionEnvelope> {
    const stakeConfigInfo = await this.getStakeConfigInfo();

    const [authority] = await PublicKey.findProgramAddress(
      [Buffer.from(STAKING_SEED_PREFIX), STAKING_CONFIG.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    const stakedHolder = await deriveAssociatedTokenAddress(authority, stakeConfigInfo.tokenMint);
    const userTokenHolder = await deriveAssociatedTokenAddress(owner, stakeConfigInfo.tokenMint);
    const userSTokenHolder = await deriveAssociatedTokenAddress(owner, stakeConfigInfo.sTokenMint);
   
    const unstakeInstruction = this.program.instruction.unstake(amount, {
      accounts: {
        staking: STAKING_CONFIG,
        authority: authority,
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

}