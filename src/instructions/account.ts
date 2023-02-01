import {
  Token as SPLToken,
  TOKEN_PROGRAM_ID,
  u64,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

import { Instruction, ResolvedTokenAddressInstruction } from "../types";
import { deriveAssociatedTokenAddress, SYSTEM_PROGRAM_ID } from "../utils";

export const createWSOLAccountInstructions = async (
  owner: PublicKey,
  solMint: PublicKey,
  amountIn: u64,
  rentExemptLamports: number
): Promise<ResolvedTokenAddressInstruction> => {
  const wSOLATA = await deriveAssociatedTokenAddress(owner, solMint);

  const closeWSOLAccountInstruction = SPLToken.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    wSOLATA,
    owner,
    owner,
    []
  );
  return {
    address: wSOLATA,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: wSOLATA,
        lamports: amountIn.toNumber() + rentExemptLamports,
      }),
      SPLToken.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        solMint,
        wSOLATA,
        owner,
        owner
      ),
    ],
    cleanupInstructions: [closeWSOLAccountInstruction],
    signers: [],
  };
};

export function createAssociatedTokenAccountInstruction(
  associatedTokenAddress: PublicKey,
  fundSource: PublicKey,
  destination: PublicKey,
  tokenMint: PublicKey,
  fundAddressOwner: PublicKey
): Instruction {
  const keys = [
    {
      pubkey: fundSource,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: destination,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: tokenMint,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSTEM_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  const createATAInstruction = new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
  return {
    instructions: [createATAInstruction],
    cleanupInstructions: [],
    signers: [],
  };
}

export const createApprovalInstruction = (
  ownerAddress: PublicKey,
  approveAmount: u64,
  tokenUserAddress: PublicKey,
  isWSOL: boolean,
  userTransferAuthority?: Keypair
): { userTransferAuthority: Keypair } & Instruction => {
  userTransferAuthority = userTransferAuthority || new Keypair();

  const approvalInstruction = SPLToken.createApproveInstruction(
    TOKEN_PROGRAM_ID,
    tokenUserAddress,
    userTransferAuthority.publicKey,
    ownerAddress,
    [],
    approveAmount
  );

  const revokeInstruction = SPLToken.createRevokeInstruction(
    TOKEN_PROGRAM_ID,
    tokenUserAddress,
    ownerAddress,
    []
  );

  return {
    userTransferAuthority: userTransferAuthority,
    instructions: [approvalInstruction],
    cleanupInstructions: isWSOL ? [] : [revokeInstruction],
    signers: [],
  };
};
