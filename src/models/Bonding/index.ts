import type { Provider } from '@saberhq/solana-contrib';

import { BondingConfig, BondingInfo } from '../../types';

import {
  PNG_BONDING_ID,
  PNG_VESTING_ID,
  deserializeAccount,
  DecimalUtil,
  ZERO_DECIMAL,
  deriveAssociatedTokenAddress,
  resolveOrCreateAssociatedTokenAddress,
  ZERO_U64
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
  Token as SPLToken,
  AccountInfo as TokenAccountInfo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import idl from './idl.json';
import vestingIdl from './vesting_idl.json';

import { Idl, Program } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';

const BONDING_SEED_PREFIX = 'bonding_authority';

const VESTING_SEED_PREFIX = 'vesting';
const VESTING_SIGNER_SEED_PREFIX = 'vesting_signer';
const VESTING_CONFIG_SIGNER_SEED_PREFIX = 'vest_config_signer';

const PNG_TOKEN_MINT = new PublicKey('PNGXZxRnRwixr7jrMSctAErSTF5SRnPQcuakkWRHe4h');

export class Bonding {
  public config: BondingConfig;
  private program: Program;
  private vestingProgram: Program;

  constructor(provider: Provider, config: BondingConfig) {
    this.config = config;
    this.program = new Program(idl as Idl, PNG_BONDING_ID, provider as any);
    this.vestingProgram = new Program(vestingIdl as Idl, PNG_VESTING_ID, provider as any);
  }

  private async getTokenAccountInfo(tokenAccount: PublicKey): Promise<Omit<TokenAccountInfo, "address"> | null> {
    const assetHolderInfo = await this.program.provider.connection.getAccountInfo(tokenAccount);
    return assetHolderInfo ? deserializeAccount(assetHolderInfo.data) : null;
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
      assetHolder,
      vTokenHolder,
      lpInfo
    } = await this.program.account.bonding.fetch(this.config.addr);

    const assetHolderInfo = await this.getTokenAccountInfo(assetHolder);

    return {
      address: this.config.addr,
      assetMint,
      assetHolder,
      vTokenHolder,
      lpInfo,
      assetHolderAmount: assetHolderInfo ? DecimalUtil.fromU64(assetHolderInfo.amount) : ZERO_DECIMAL
    }
  }

  async calcPayout(bondingInfo: BondingInfo, amount: u64) {
    let valudation = 0;
    if (bondingInfo?.lpInfo) {

      const assetToken = new SPLToken(
        this.program.provider.connection, 
        new PublicKey(bondingInfo.assetMint), 
        TOKEN_PROGRAM_ID,
        {} as any
      );

      const [tokenAAccountInfo, tokenBAccountInfo, assetTokenMintInfo] = await Promise.all([
        this.getTokenAccountInfo(bondingInfo.lpInfo.tokenAHolder),
        this.getTokenAccountInfo(bondingInfo.lpInfo.tokenBHolder),
        assetToken.getMintInfo()
      ]);

      const decimals = 6;
      const tokenAAmount = tokenAAccountInfo?.amount || ZERO_U64;
      const tokenBAmount = tokenBAccountInfo?.amount || ZERO_U64;

      const kValue =
        tokenAAmount
          .mul(tokenBAmount)
          .div(new u64(Math.pow(10, decimals)))
          .toNumber()

      const totalValue = Math.sqrt(kValue) * 2;

      valudation = amount
        .mul(new u64(Math.floor(totalValue)))
        .div(assetTokenMintInfo.supply)
        .toNumber();
    } else {
      valudation =
        amount
          .mul(new u64(Math.pow(10, 6)))
          .div(new u64(Math.pow(10, 6)))
          .toNumber()

    }
  }

  async purchaseLPToken(amount: u64) {
    const bondingInfo = await this.getBondingInfo();

    const [bondingPda] = await PublicKey.findProgramAddress(
      [Buffer.from(BONDING_SEED_PREFIX), this.config.addr.toBuffer()],
      this.program.programId
    );

    const owner = this.program.provider.wallet?.publicKey;

    // Resolve or create asset user account;
    const userAssetHolder = await deriveAssociatedTokenAddress(owner, bondingInfo.assetMint);
    const vTokenHolderInfo = await this.getTokenAccountInfo(bondingInfo.vTokenHolder);

    const vTokenMint = vTokenHolderInfo?.mint || PublicKey.default;

    const { address: userVTokenHolder, ...resolveUserVTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        vTokenMint,
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

    const vestedHolder = await deriveAssociatedTokenAddress(vSigner, vTokenMint);
    
    if (!vestingAccountInfo) {
    
      vestingInstructions.push(this.vestingProgram.instruction.initVesting(nonce, {
        accounts: {
          vestConfig: this.config.vestConfig,
          vesting: vestingAddr,
          vestMint: vTokenMint,
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

    const updateInstruction = this.vestingProgram.instruction.update({
      accounts: {
        vestConfig: this.config.vestConfig,
        vesting: vestingAddr,
        vestedHolder,
        vestMint: vTokenMint,
        vestingSigner: vSigner,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
    });

    const vestInstruction = this.vestingProgram.instruction.vest(new u64(1_000_000), {
      accounts: {
        vesting: vestingAddr,
        vestedHolder,
        userVestHolder: userVTokenHolder,
        owner,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      instructions: [updateInstruction]
    });

    return new TransactionEnvelope(
        this.program.provider as any,
        [
          ...resolveUserVTokenAccountInstrucitons.instructions,
          purchaseInstruction,
          ...vestingInstructions
        ],
        [
          ...resolveUserVTokenAccountInstrucitons.signers
        ]
      ).combine(
        new TransactionEnvelope(
          this.program.provider as any,
          [
            updateInstruction,
            vestInstruction
          ]
        )
      );

  }

  async claimVestedToken() {
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
    
    const vTokenHolderInfo = await this.getTokenAccountInfo(bondingInfo.vTokenHolder);
    const vTokenMint = vTokenHolderInfo?.mint || PublicKey.default;

    const vestedHolder = await deriveAssociatedTokenAddress(vSigner, vTokenMint);

    const claimableHolder = await deriveAssociatedTokenAddress(
      vcSigner,
      PNG_TOKEN_MINT
    );

    const { address: userTokenHolder, ...resolveUserTokenAccountInstrucitons } =
      await resolveOrCreateAssociatedTokenAddress(
        this.program.provider.connection,
        owner,
        PNG_TOKEN_MINT
      );
    
    const updateInstruction = this.vestingProgram.instruction.update({
      accounts: {
        vestConfig: this.config.vestConfig,
        vesting: vestingAddr,
        vestedHolder,
        vestMint: vTokenMint,
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

}