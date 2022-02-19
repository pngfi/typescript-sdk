import {
    deriveAssociatedTokenAddress,
    resolveOrCreateAssociatedTokenAddress,
} from '../../utils';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import idl from './idl.json';

import { BN, Idl, Program, Provider } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';

const REWARDS_PROGRAM_ID = new PublicKey('PMRKTWvK9f1cPkQuXvvyDPmyCSoq8FdedCimXrXJp8M');

export class Rewards {
    public rewardsInfo: any;
    private program: Program;

    constructor(provider: Provider, rewardsInfo: any) {
        this.rewardsInfo = rewardsInfo;
        this.program = new Program(idl as Idl, REWARDS_PROGRAM_ID, provider as any);
    }

    async claim(): Promise<TransactionEnvelope> {
        const { distributor, amount, index, proof, rootVersion } = this.rewardsInfo;

        const owner = this.program.provider.wallet?.publicKey;

        const distributorAcc = await this.program.account.merkleDistributor.fetch(new PublicKey(distributor));

        let [claimStatus, claimNonce] = await PublicKey.findProgramAddress(
            [Buffer.from("ClaimStatus"), new PublicKey(distributor).toBuffer(), owner.toBuffer()],
            this.program.programId
        );

        const distributorHolder = await deriveAssociatedTokenAddress(new PublicKey(distributor), distributorAcc.mint);
        const { address: userHolder, ...resolveUserHolderInstrucitons } =
            await resolveOrCreateAssociatedTokenAddress(
                this.program.provider.connection,
                owner,
                distributorAcc.mint,
            );

        const rewardsInstruction = this.program.instruction.claim(
            new BN(claimNonce),
            new BN(rootVersion),
            new BN(index),
            new BN(amount),
            proof.map((p: any) => Buffer.from(p, "hex")),
            {
                accounts: {
                    distributor: new PublicKey(distributor),
                    claimStatus,
                    from: distributorHolder,
                    to: userHolder,
                    claimant: owner,
                    payer: owner,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }
        );

        return new TransactionEnvelope(
            this.program.provider as any,
            [
                ...resolveUserHolderInstrucitons.instructions,
                rewardsInstruction
            ],
            [
                ...resolveUserHolderInstrucitons.signers
            ]
        );
    }

}