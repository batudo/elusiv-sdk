import {
    Commitment, IncompleteCommitment, MontScalar, Poseidon, ReprScalar,
} from '@elusiv/cryptojs';
import { equalsUint8Arr } from '@elusiv/serialization';
import { Cluster, Connection } from '@solana/web3.js';
import { deserialize } from '@dao-xyz/borsh';
import { PartialSendTx, SendTx } from '../transactions/SendTx.js';
import { PartialStoreTx } from '../transactions/StoreTx.js';
import { TreeManager } from './TreeManager.js';
import { TransactionManager } from '../txManagers/TransactionManager.js';
import {
    INVALID_SIZE, INVALID_TX_TYPE, SEND_ARITY, STORAGE_ACC_SEED,
} from '../../constants.js';
import { getNumberFromTokenType } from '../../public/tokenTypes/TokenTypeFuncs.js';
import { buildCommitmentSet, GeneralSet } from '../utils/GeneralSet.js';
import { ElusivTransaction } from '../transactions/ElusivTransaction.js';
import { zipSameLength } from '../utils/utils.js';
import { SeedWrapper } from '../clientCrypto/SeedWrapper.js';
import { TokenType } from '../../public/tokenTypes/TokenType.js';
import { CommitmentMetadata } from '../clientCrypto/CommitmentMetadata.js';
import { AccountReader } from '../accountReaders/AccountReader.js';
import { getElusivProgramId } from '../../public/WardenInfo.js';
import { AccIndex, IndexConverter, LocalIndex } from '../utils/IndexConverter.js';
import { TreeChunkAccountReader } from '../accountReaders/TreeChunkAccountReader.js';
import { StorageAccBorsh } from '../transactions/txBuilding/serializedTypes/borshTypes/accounts/StorageAccBorsh.js';
import { StorageAccountReader } from '../accountReaders/StorageAccountReader.js';
import { Pair } from '../utils/Pair.js';

export class CommitmentManager {
    cluster: Cluster;

    connection: Connection;

    txManager: TransactionManager;

    treeManager: TreeManager;

    private constructor(connection:Connection, cluster: Cluster, txManager: TransactionManager, treeManager: TreeManager) {
        this.connection = connection;
        this.cluster = cluster;
        this.txManager = txManager;
        this.treeManager = treeManager;
    }

    public static createCommitmentManager(
        connection: Connection,
        cluster: Cluster,
        treeManager: TreeManager,
        txManager: TransactionManager,
    ): CommitmentManager {
        return new CommitmentManager(connection, cluster, txManager, treeManager);
    }

    public async getIncompleteCommitmentsForTxs(txs: ElusivTransaction[], seedWrapper: SeedWrapper): Promise<{ commitments: GeneralSet<IncompleteCommitment>, startIndices: (number | undefined)[] }> {
        const activeCommitments: GeneralSet<IncompleteCommitment> = buildCommitmentSet();
        const startIndices: (number | undefined)[] = [];
        const sendTxCommitments: Promise<IncompleteCommitment>[] = [];

        txs.forEach((tx) => {
            if (tx.txType === 'TOPUP') {
                const comm = CommitmentManager.buildCommitmentForPartialStore(tx as PartialStoreTx, seedWrapper);
                activeCommitments.add(comm);
                startIndices.push((tx as PartialStoreTx).merkleStartIndex);
            }
            else if (tx.txType === 'SEND') {
                sendTxCommitments.push(this.getCommitmentForPartialSend(tx as PartialSendTx, seedWrapper));
                startIndices.push((tx as SendTx).merkleStartIndex);
            }
        });

        const sendTxCommitmentsRes = await Promise.all(sendTxCommitments);
        sendTxCommitmentsRes.forEach((comm) => {
            activeCommitments.add(comm);
        });

        return { commitments: activeCommitments, startIndices };
    }

    public async getActiveCommitments(tokenType: TokenType, seedWrapper: SeedWrapper, beforeSend?: SendTx): Promise<GeneralSet<Commitment>> {
        // We need to manually check if the latest tx is confirmed
        const activeTxs = await this.txManager.getActiveTxs(tokenType, beforeSend);
        if (activeTxs.length === 0) return buildCommitmentSet() as GeneralSet<Commitment>;
        if (!(await this.isTransactionConfirmed(activeTxs[0], seedWrapper))) {
            throw new Error('Cannot create transaction while still waiting for tx to confirm');
        }
        const activeComms = await this.getIncompleteCommitmentsForTxs(activeTxs, seedWrapper);
        return this.activateCommitments(activeComms.commitments, activeComms.startIndices);
    }

    public static needMerge(activeCommitments: IncompleteCommitment[]): boolean {
        if (activeCommitments.length > SEND_ARITY) throw new Error(INVALID_SIZE('active commitmetns', activeCommitments.length, SEND_ARITY));

        return activeCommitments.length === SEND_ARITY;
    }

    public async isCommitmentInserted(commitmentHash: ReprScalar, startingIndex = 0): Promise<boolean> {
        return this.treeManager.hasCommitment(commitmentHash, startingIndex);
    }

    public async isTransactionConfirmed(tx: ElusivTransaction, seedWrapper: SeedWrapper): Promise<boolean> {
        return tx.txType === 'TOPUP'
            ? this.isCommitmentInserted(CommitmentManager.buildCommitmentForPartialStore(tx as PartialStoreTx, seedWrapper).getCommitmentHash(), (tx as PartialStoreTx).merkleStartIndex)
            : this.getCommitmentForTransaction(tx, seedWrapper).then((comm) => this.isCommitmentInserted(comm.getCommitmentHash(), (tx as SendTx).merkleStartIndex));
    }

    // "Activate" an incomplete commitment (i.e. add the data to its tree position)
    private async activateCommitmentsInner(ics: IncompleteCommitment[], startingIndices: number[]): Promise<Commitment[]> {
        const res = await this.treeManager.getCommitmentsInfo(
            zipSameLength(ics.map((ic) => ic.getCommitmentHash()), startingIndices),
        );
        return res.map((r, i) => (Commitment.fromIncompleteCommitment(ics[i], r.opening, r.root, r.index, Poseidon.getPoseidon())));
    }

    // "Activate" an array of incomplete commitments
    public async activateCommitments(
        incompleteCommitments: GeneralSet<IncompleteCommitment>,
        startIndices: (number | undefined)[],
    ): Promise<GeneralSet<Commitment>> {
        const incompleteCommsArr = incompleteCommitments.toArray();

        const normalizedSIs = CommitmentManager.normalizeStartIndices(startIndices);

        const activatedComms = this.activateCommitmentsInner(incompleteCommsArr, normalizedSIs);

        const res = buildCommitmentSet() as unknown as GeneralSet<Commitment>;
        return activatedComms.then((comms) => {
            for (const c of comms) {
                res.add(c);
            }
            return res;
        });
    }

    public async getCommitmentForTransaction(tx: ElusivTransaction, seedWrapper: SeedWrapper): Promise<IncompleteCommitment> {
        if (tx.txType === 'TOPUP') return CommitmentManager.buildCommitmentForPartialStore(tx as PartialStoreTx, seedWrapper);
        if (tx.txType === 'SEND') return this.getCommitmentForPartialSend(tx as PartialSendTx, seedWrapper);
        throw new Error(INVALID_TX_TYPE);
    }

    public async awaitCommitmentInsertion(commitmentHash: ReprScalar, startingIndex = 0): Promise<boolean> {
        return new Promise((resolve) => {
            const startPointer: LocalIndex = TreeManager.commLeafIndexToLocalIndex(startingIndex);

            const storageAcc = AccountReader.generateElusivPDAFrom([STORAGE_ACC_SEED], getElusivProgramId(this.cluster))[0];

            const accIndex = IndexConverter.localIndexToAccIndex(startPointer);
            const treeChunkReader = new TreeChunkAccountReader(this.connection);
            const commMont: Pair<MontScalar, AccIndex>[] = [{ fst: Poseidon.getPoseidon().reprToMont(commitmentHash), snd: accIndex }];

            let subscriptionId: number | null = null;

            let commitmentIndex: LocalIndex = { index: -1, level: -1 };
            subscriptionId = this.connection.onAccountChange(storageAcc, async (accInfo) => {
                const storageAccData = deserialize(accInfo.data, StorageAccBorsh);

                const fetchedCommitmentIndices = await StorageAccountReader.findCommitmentIndicesAcrossChunks(commMont, treeChunkReader, storageAccData);

                const gIndex = fetchedCommitmentIndices.get(commMont[0].fst);
                if (gIndex) {
                    commitmentIndex = IndexConverter.globalIndexToLocalIndex(gIndex);
                }
            }, 'finalized');

            if (commitmentIndex !== undefined) {
                // Close the connection when commitmentIndex exists
                this.connection.removeAccountChangeListener(subscriptionId);
                resolve(commitmentIndex.index !== -1);
            }
        });
    }

    private async getCommitmentForPartialSend(partialSendTx: PartialSendTx, seedWrapper: SeedWrapper): Promise<IncompleteCommitment> {
        if (partialSendTx.metadata) {
            const res = CommitmentManager.commFromMetadata(seedWrapper, partialSendTx.metadata);
            if (equalsUint8Arr(res.getCommitmentHash(), partialSendTx.commitmentHash)) return res;
        }

        // Otherwise fetch the slow, but 100% sure way
        const privateBalanceSlow = this.txManager.getPrivateBalanceFromTxHistory(
            partialSendTx.tokenType,
            partialSendTx.nonce,
        );
        const resSlow = CommitmentManager.buildCommitmentForPartialSend(partialSendTx, await privateBalanceSlow, seedWrapper);
        if (!equalsUint8Arr(resSlow.getCommitmentHash(), partialSendTx.commitmentHash)) throw new Error(`Failed to reconstruct commitment for nonce ${partialSendTx.nonce}`);
        return resSlow;
    }

    private static buildCommitmentForPartialSend(partialSendTx: PartialSendTx, privateBalanceBeforeNonce: bigint, seedWrapper: SeedWrapper): IncompleteCommitment {
        const nullifier = seedWrapper.generateNullifier(partialSendTx.nonce);
        // The resulting commitment is the UTXO of the send (partialSendTx.amount would just be the amount transferred, not the amount left over)
        const totalFee = partialSendTx.fee;
        return this.buildCommitmentForSend(nullifier, partialSendTx.tokenType, privateBalanceBeforeNonce, partialSendTx.amount, totalFee, partialSendTx.merkleStartIndex);
    }

    // Build a commitment for a send transaction
    // NOTE: totalFee does NOT include extra fee and rent fee, these are already added to amount
    public static buildCommitmentForSend(
        nullifier: Uint8Array,
        tokenType: TokenType,
        privateBalanceBeforeNonce: bigint,
        sendAmount: bigint,
        totalFee: bigint,
        assocCommIndex: number,
    ): IncompleteCommitment {
        // The resulting commitment is the UTXO of the send (partialSendTx.amount would just be the amount transferred, not the amount left over)
        const currPrivBalance = privateBalanceBeforeNonce
            - sendAmount
            - totalFee;
        return new IncompleteCommitment(
            nullifier,
            currPrivBalance,
            BigInt(getNumberFromTokenType(tokenType)),
            BigInt(assocCommIndex),
            Poseidon.getPoseidon(),
        );
    }

    public static buildCommitmentForPartialStore(partialStoreTx: PartialStoreTx, seedWrapper: SeedWrapper): IncompleteCommitment {
        const nullifier = seedWrapper.generateNullifier(partialStoreTx.nonce);
        return new IncompleteCommitment(
            nullifier,
            partialStoreTx.amount,
            BigInt(getNumberFromTokenType(partialStoreTx.tokenType)),
            BigInt(partialStoreTx.merkleStartIndex),
            Poseidon.getPoseidon(),
        );
    }

    private static normalizeStartIndices(startIndices: readonly (number | undefined)[]): number[] {
        let defaultStartIndex = 0;
        const res: number[] = [];

        startIndices.forEach((si) => {
            // Default start index is always the last defined start index
            if (si === undefined) {
                res.push(defaultStartIndex);
            }
            else {
                res.push(si);
                defaultStartIndex = si;
            }
        });

        return res;
    }

    private static commFromMetadata(seedWrapper: SeedWrapper, meta: CommitmentMetadata): IncompleteCommitment {
        const nullifier = seedWrapper.generateNullifier(meta.nonce);
        return new IncompleteCommitment(
            nullifier,
            meta.balance,
            BigInt(getNumberFromTokenType(meta.tokenType)),
            BigInt(meta.assocCommIndex),
            Poseidon.getPoseidon(),
        );
    }
}
