import type { Layout } from '@solana/buffer-layout';
import type { AccountInfo } from '@solana/spl-token';
import type { Provider } from '@saberhq/solana-contrib';

import {
  AccountLayout,
  AccountInfo as TokenAccountInfo,
  u64,
  Token as SPLToken,
  TOKEN_PROGRAM_ID,
  MintInfo
} from '@solana/spl-token';

import {
  PublicKey,
  Keypair,
  Signer,
  SystemProgram
} from '@solana/web3.js';

import { Instruction } from '../types';

/**
 * Layout with decode/encode types.
 */
export type TypedLayout<T> = Omit<Layout, 'decode' | 'encode'> & {
  decode: (data: Buffer) => T;
  encode: (data: T, out: Buffer) => number;
};

export type ResolvedTokenAccountInstruction = { address: PublicKey } & Instruction;

/**
 * Layout for a TokenAccount.
 */
export const TokenAccountLayout = AccountLayout as TypedLayout<{
  mint: Buffer;
  owner: Buffer;
  amount: Buffer;
  delegateOption: number;
  delegate: Buffer;
  state: number;
  delegatedAmount: Buffer;
  isNativeOption: number;
  isNative: Buffer;
  closeAuthorityOption: number;
  closeAuthority: Buffer;
}>;

export const deserializeAccount = (
  data: Buffer
): Omit<AccountInfo, "address"> => {
  const accountInfo = TokenAccountLayout.decode(data);

  const mint = new PublicKey(accountInfo.mint);
  const owner = new PublicKey(accountInfo.owner);
  const amount = u64.fromBuffer(accountInfo.amount);

  let delegate: PublicKey | null;
  let delegatedAmount: u64;

  if (accountInfo.delegateOption === 0) {
    delegate = null;
    delegatedAmount = new u64(0);
  } else {
    delegate = new PublicKey(accountInfo.delegate);
    delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
  }

  const isInitialized = accountInfo.state !== 0;
  const isFrozen = accountInfo.state === 2;

  let rentExemptReserve: u64 | null;
  let isNative: boolean;

  if (accountInfo.isNativeOption === 1) {
    rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
    isNative = true;
  } else {
    rentExemptReserve = null;
    isNative = false;
  }

  let closeAuthority: PublicKey | null;
  if (accountInfo.closeAuthorityOption === 0) {
    closeAuthority = null;
  } else {
    closeAuthority = new PublicKey(accountInfo.closeAuthority);
  }

  return {
    mint,
    owner,
    amount,
    delegate,
    delegatedAmount,
    isInitialized,
    isFrozen,
    rentExemptReserve,
    isNative,
    closeAuthority,
  };
}

export const getTokenAccountInfo = async (
  provider: Provider,
  tokenAccount: PublicKey
): Promise<Omit<TokenAccountInfo, "address"> | null> => {
  const assetHolderInfo = await provider.connection.getAccountInfo(tokenAccount);
  return assetHolderInfo ? deserializeAccount(assetHolderInfo.data) : null;
}

export const getTokenMintInfo = async (
  provider: Provider,
  tokenMint: PublicKey
): Promise<MintInfo> => {
  const token = new SPLToken(
    provider.connection,
    tokenMint,
    TOKEN_PROGRAM_ID, {} as any
  );

  return token.getMintInfo();
}

export const createTokenAccount = async ({
  provider,
  mint,
  owner = provider.wallet.publicKey,
  payer = provider.wallet.publicKey,
  accountSigner = Keypair.generate(),
}: {
  provider: Provider;
  mint: PublicKey;
  owner?: PublicKey;
  payer?: PublicKey;
  /**
   * The keypair of the account to be created.
   */
  accountSigner?: Signer;
}): Promise<ResolvedTokenAccountInstruction> => {
  // Allocate memory for the account
  const balanceNeeded = await SPLToken.getMinBalanceRentForExemptAccount(
    provider.connection
  );

  const tokenAccount = accountSigner.publicKey;

  return {
    address: accountSigner.publicKey,
    instructions: [
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: accountSigner.publicKey,
        lamports: balanceNeeded,
        space: TokenAccountLayout.span,
        programId: TOKEN_PROGRAM_ID,
      }),
      SPLToken.createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        mint,
        tokenAccount,
        owner
      ),
    ],
    cleanupInstructions: [],
    signers: [accountSigner]
  }

}

export async function createTokenMint(
  provider: Provider,
  authority: PublicKey,
  mint: PublicKey,
  decimals = 6
): Promise<Instruction> {
  const instructions = [
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID,
    }),
    SPLToken.createInitMintInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      decimals,
      authority,
      null
    ),
  ];

  return {
    instructions,
    signers: [],
    cleanupInstructions: []
  }
}

export async function transferToken(
  source: PublicKey,
  destination: PublicKey,
  amount: u64,
  payer: PublicKey
): Promise<Instruction> {
  const instructions = [
    SPLToken.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      source,
      destination,
      payer,
      [],
      amount
    )
  ];

  return {
    instructions,
    signers: [],
    cleanupInstructions: []
  }
}