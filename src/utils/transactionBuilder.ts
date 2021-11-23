import {
  Signer,
  TransactionInstruction,
} from '@solana/web3.js';

import { Instruction } from '../types';
import type { Provider } from '@saberhq/solana-contrib';
import { TransactionEnvelope } from '@saberhq/solana-contrib';

export class TransactionBuilder {
  private provider: Provider;
  private instructions: Instruction[];

  constructor(provider: Provider) {
    this.provider = provider;
    this.instructions = [];
  }

  addInstruction(instruction: Instruction): TransactionBuilder {
    this.instructions.push(instruction);
    return this;
  }

  build(): TransactionEnvelope {

    let instructions: TransactionInstruction[] = [];
    let cleanupInstructions: TransactionInstruction[] = [];
    let signers: Signer[] = [];
    this.instructions.forEach((curr) => {
     
      instructions = instructions.concat(curr.instructions);
      cleanupInstructions = cleanupInstructions.concat(curr.cleanupInstructions);
      signers = signers.concat(curr.signers);
    });

    return new TransactionEnvelope(
      this.provider,
      instructions.concat(cleanupInstructions),
      signers
    );

  }
}