import { Cluster, ConfirmedSignatureInfo, PublicKey } from '@solana/web3.js';
import { TokenType } from './TokenType';
import { AirdropParams } from '../../sdk/transactions/txBuilding/serializedTypes/types.js';
import { TransactionSerialization } from '../../sdk/transactions/txBuilding/wardenSerialization/TransactionSerialization.js';
import { buildWardenRequest } from '../../sdk/transactions/txBuilding/wardenSerialization/utils.js';
import { WardenCommunicator } from '../../sdk/txSending/WardenCommunication.js';
import { WardenInfo, getDefaultWarden } from '../WardenInfo.js';

/**
 *
 * @param tokenType The token type to airdrop.
 * @param amount The amount to airdrop.
 * @param recipientTA The recipient of the airdrop's token account. Use the getMintAccount method to help you create this.
 * @param cluster The cluster on which to get the mint (mainnet is not valid)
 * @param wardenInfo Controls what warden is used. Filled in with default config.
 * @returns A signature indicating the airdrop transaction on success. Throws on failure.
 */
export async function airdropToken(tokenType: TokenType, amount: number, recipientTA: PublicKey, cluster: Cluster = 'devnet', wardenInfo: WardenInfo = getDefaultWarden(cluster)): Promise<ConfirmedSignatureInfo> {
    if (cluster !== 'devnet' && cluster !== 'testnet') throw new Error('Airdrop only available on devnet and testnet');
    const params: AirdropParams = [
        tokenType,
        amount,
        TransactionSerialization.serializeU256Bytes(recipientTA.toBytes()),
    ];
    const request = buildWardenRequest('airdrop', params);

    const communicator = new WardenCommunicator(wardenInfo);
    return communicator.postWardenSigRequest(request).then((res) => TransactionSerialization.deserializeSerializedSignature(res.result));
}
