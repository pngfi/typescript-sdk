import {
  AccountLayout,
  TOKEN_PROGRAM_ID,
  u64,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
} from "@solana/spl-token";

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

import { emptyInstruction, ResolvedTokenAddressInstruction } from "../types";

import {
  SOL_TOKEN_MINT,
  deserializeAccount,
  TokenAccountLayout,
} from "../utils";

import {
  createAssociatedTokenAccountInstruction,
  createWSOLAccountInstructions,
} from "../instructions";

/**
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param connection Solana connection class
 * @param owner The keypair for the user's wallet or just the user's public key
 * @param tokenMint Token mint address
 * @param wrappedSolAmountIn Optional. Only use for input/source token that could be SOL
 * @returns
 */
export async function resolveOrCreateAssociatedTokenAddress(
  connection: Connection,
  owner: PublicKey,
  tokenMint: PublicKey,
  wrappedSolAmountIn = new u64(0)
): Promise<ResolvedTokenAddressInstruction> {
  if (!tokenMint.equals(SOL_TOKEN_MINT)) {
    const derivedAddress = await deriveAssociatedTokenAddress(owner, tokenMint);
    // Check if current wallet has an ATA for this spl-token mint. If not, create one.
    let resolveAtaInstruction = emptyInstruction;

    let tokenAccountInfo: any = await connection.getAccountInfo(derivedAddress);

    if (tokenAccountInfo) {
      tokenAccountInfo = deserializeAccount(tokenAccountInfo.data);
    }

    if (!tokenAccountInfo) {
      resolveAtaInstruction = createAssociatedTokenAccountInstruction(
        derivedAddress,
        owner,
        owner,
        tokenMint,
        owner
      );
    }

    return {
      address: derivedAddress,
      instructions: resolveAtaInstruction.instructions,
      cleanupInstructions: resolveAtaInstruction.cleanupInstructions,
      signers: resolveAtaInstruction.signers,
    };
  }

  const wSOLATA = await deriveAssociatedTokenAddress(owner, tokenMint);
  const wSOLTokenAccountInfo = await connection.getAccountInfo(wSOLATA);
  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span
  );
  // if wSOL account exists, check if it has enough balance to cover the amount
  if (wSOLTokenAccountInfo) {
    const tokenData = TokenAccountLayout.decode(wSOLTokenAccountInfo.data);
    // if wSOL account has enough balance, return it
    if (u64.fromBuffer(tokenData.amount).gte(wrappedSolAmountIn)) {
      return {
        address: wSOLATA,
        instructions: [],
        cleanupInstructions: [],
        signers: [],
      };
    }
    const wSOLAccountInstruction = await createWSOLAccountInstructions(
      owner,
      tokenMint,
      wrappedSolAmountIn,
      accountRentExempt
    );
    const instructions: TransactionInstruction[] = [];
    instructions.push(
      Token.createCloseAccountInstruction(
        TOKEN_PROGRAM_ID,
        wSOLATA,
        owner,
        owner,
        []
      ),
      ...wSOLAccountInstruction.instructions
    );
    return {
      address: wSOLATA,
      instructions,
      cleanupInstructions: wSOLAccountInstruction.cleanupInstructions,
      signers: wSOLAccountInstruction.signers,
    };
  }
  // if wSOL account does not exist, create one
  return createWSOLAccountInstructions(
    owner,
    tokenMint,
    wrappedSolAmountIn,
    accountRentExempt
  );
}

export async function createAssociatedTokenAddress(
  connection: Connection,
  owner: PublicKey,
  tokenMint: PublicKey,
  wrappedSolAmountIn = new u64(0)
): Promise<ResolvedTokenAddressInstruction> {
  const accountKP = Keypair.generate();
  const resolveAtaInstruction = createAssociatedTokenAccountInstruction(
    accountKP.publicKey,
    owner,
    owner,
    tokenMint,
    owner
  );

  return {
    address: accountKP.publicKey,
    instructions: resolveAtaInstruction.instructions,
    cleanupInstructions: resolveAtaInstruction.cleanupInstructions,
    signers: resolveAtaInstruction.signers,
  };
}

export async function deriveAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMint: PublicKey
): Promise<PublicKey> {
  return (
    await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )[0];
}
