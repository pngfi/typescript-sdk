import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import * as BufferLayout from '@solana/buffer-layout';
import { Numberu64 } from '@solana/spl-token-swap';

export const createInitSwapInstruction = (
  tokenSwapAccount: Keypair,
  authority: PublicKey,
  tokenAccountA: PublicKey,
  tokenAccountB: PublicKey,
  tokenPool: PublicKey,
  feeAccount: PublicKey,
  tokenAccountPool: PublicKey,
  tokenProgramId: PublicKey,
  swapProgramId: PublicKey,
  tradeFeeNumerator: number,
  tradeFeeDenominator: number,
  ownerTradeFeeNumerator: number,
  ownerTradeFeeDenominator: number,
  ownerWithdrawFeeNumerator: number,
  ownerWithdrawFeeDenominator: number,
  hostFeeNumerator: number,
  hostFeeDenominator: number,
  curveType: number,
  curveParameters: Numberu64 = new Numberu64(0),
): TransactionInstruction => {
  const keys = [
    {pubkey: tokenSwapAccount.publicKey, isSigner: false, isWritable: true},
    {pubkey: authority, isSigner: false, isWritable: false},
    {pubkey: tokenAccountA, isSigner: false, isWritable: false},
    {pubkey: tokenAccountB, isSigner: false, isWritable: false},
    {pubkey: tokenPool, isSigner: false, isWritable: true},
    {pubkey: feeAccount, isSigner: false, isWritable: false},
    {pubkey: tokenAccountPool, isSigner: false, isWritable: true},
    {pubkey: tokenProgramId, isSigner: false, isWritable: false},
  ];
  const commandDataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    BufferLayout.nu64('tradeFeeNumerator'),
    BufferLayout.nu64('tradeFeeDenominator'),
    BufferLayout.nu64('ownerTradeFeeNumerator'),
    BufferLayout.nu64('ownerTradeFeeDenominator'),
    BufferLayout.nu64('ownerWithdrawFeeNumerator'),
    BufferLayout.nu64('ownerWithdrawFeeDenominator'),
    BufferLayout.nu64('hostFeeNumerator'),
    BufferLayout.nu64('hostFeeDenominator'),
    BufferLayout.u8('curveType'),
    BufferLayout.blob(32, 'curveParameters'),
  ]);
  let data = Buffer.alloc(1024);

  // package curve parameters
  // NOTE: currently assume all curves take a single parameter, u64 int
  //       the remaining 24 of the 32 bytes available are filled with 0s
  let curveParamsBuffer = Buffer.alloc(32);
  curveParameters.toBuffer().copy(curveParamsBuffer);

  {
    const encodeLength = commandDataLayout.encode(
      {
        instruction: 0, // InitializeSwap instruction
        tradeFeeNumerator,
        tradeFeeDenominator,
        ownerTradeFeeNumerator,
        ownerTradeFeeDenominator,
        ownerWithdrawFeeNumerator,
        ownerWithdrawFeeDenominator,
        hostFeeNumerator,
        hostFeeDenominator,
        curveType,
        curveParameters: curveParamsBuffer,
      },
      data,
    );
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  });

}
