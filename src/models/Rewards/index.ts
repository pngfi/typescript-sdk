import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN, Idl, Program, Provider } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import idl from './idl.json';
import {
    BUD_REWARD_ID,
    deriveAssociatedTokenAddress,
    resolveOrCreateAssociatedTokenAddress,
} from '../../utils';

export class Rewards {
    public rewardsInfo: any;
    private program: Program;

    constructor(provider: Provider, rewardsInfo: any) {
        this.rewardsInfo = rewardsInfo;
        this.program = new Program(idl as Idl, BUD_REWARD_ID, provider as any);
    }

    async getClaimStatusInfo() {
        const { distributor } = this.rewardsInfo;
        const owner = this.program.provider.wallet?.publicKey;

        let [claimStatus, _] = await PublicKey.findProgramAddress(
            [Buffer.from("ClaimStatus"), new PublicKey(distributor).toBuffer(), owner.toBuffer()],
            this.program.programId
        );
        let claimStatusAcc;

        try {
            claimStatusAcc = await this.program.account.claimStatus.fetch(claimStatus);
        } catch (error) {
            console.log(error);
        }
        return claimStatusAcc;
    }

    async claim(): Promise<TransactionEnvelope> {
        const { distributor, amount, index, proof, root } = this.rewardsInfo;
        console.log(this.rewardsInfo);

        const owner = this.program.provider.wallet?.publicKey;

        const distributorAcc = await this.program.account.merkleDistributor.fetch(new PublicKey(distributor));
        console.log('distributorAcc:', distributorAcc);
        // const rootStr = distributorAcc.root.reduce((str: any, byte: any) => str + byte.toString(16).padStart(2, '0'), '');
        // console.log('rootStr', rootStr);
        // if(rootStr !== root){}

        let [claimStatus, claimNonce] = await PublicKey.findProgramAddress(
            [Buffer.from("ClaimStatus"), new PublicKey(distributor).toBuffer(), owner.toBuffer()],
            this.program.programId
        );

        const distributorHolder = await deriveAssociatedTokenAddress(new PublicKey(distributor), distributorAcc.mint);
        const { address: userHolder, ...resolveUserHolderInstrucitons } =
            await resolveOrCreateAssociatedTokenAddress(
                this.program.provider.connection,
                owner,
                distributorAcc.mint
            );

        const rewardsInstruction = this.program.instruction.claim(
            new BN(claimNonce),
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
                    tokenProgram: TOKEN_PROGRAM_ID
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