import { PublicKey } from '@solana/web3.js';
import { TokenType } from './tokenTypes/TokenType';

/**
 * @typedef {Object} FeeCalcInfo - Information needed to calculate the fee for an elusiv transaction
 * @property {number} amount - The amount of tokens to topup/send
 * @property {TokenType} tokenType - The type of token to topup/send
 */
export type FeeCalcInfo = {
    amount: number,
    tokenType: TokenType,
}

/**
 * An optional additional fee integrators can specify to be
 * deducted from the user's private balance when sending.
 * NOTE: Currently this only supports paying the fee in the same
 * TokenType as the send.
 */
export type OptionalFee = {
    /**
     * The account with which to receive the extra fee.
     * This must be the owner account (not the ATA / a TA) and must
     * have an initialized ATA of the TokenType with which the fee will be paid.
     */
    collector: PublicKey,
    amount: bigint,
}

/**
 * Fee without an extra fee specified.
 */
export type BasicFee = {
    /**
     *  The token type in which the fee is provided
     */
    readonly tokenType: TokenType;
    /**
     *  The fee that we pay to Solana for computation, rent etc. in the above tokentype
     */
    readonly txFee: number;
    /**
     *  The fee that we pay to the Elusiv Network in the above tokentype
     */
    readonly privacyFee: number;

    /**
     * The amount of rent required for newly creating the recipients Solana token account
     * (in case they don't have one yet).
    */
    readonly tokenAccRent: number;
    /**
     *  The rate at which the fee will be APPROXIMATELY paid. Remember, we're dealing with the smallest denomination of each token here
     *  e.g. 1_000_000 "USDC" = 1$
     */
    readonly lamportsPerToken?: number;
}

export type Fee = BasicFee & {
    /**
     * Fee that was paid to a third party on top of the normal fee
     */
    readonly extraFee: number;
}

/**
 * @typedef {Object} SendFeeCalcInfo - Information needed to calculate the fee for a send transaction
 * @property {PublicKey} recipient - Recipient for the send (the owner/sol account, not the SPL account). In the case of the tokentype being an
 * SPL token, the ATA of this account is taken unless a different one is specified via the customRecipientTA parameter.
 * @property {OptionalFee} [extraFee] - Optional fee to be collected by a third party in the same TokenType as the send. If not provided, no fee will be collected. When specifying the collector here,
 * make sure its ATA already exists. If you wish to use a custom TA for the collector, use the customFeeCollectorTA parameter.
 * @property {PublicKey} [customRecipientTA] - For the case that you want to provide an override for a Token Account to send to that is not the recipient's ATA. Make sure this token account
 * is funded with rent, else this will fail.
 */
export type SendFeeCalcInfo = FeeCalcInfo & {
    recipient: PublicKey,
    extraFee?: OptionalFee,
    customRecipientTA?: PublicKey,
}

/**
 * @typedef {Object} TopupFeeCalcInfo - Information needed to calculate the fee for a topup transaction
 */
export type TopupFeeCalcInfo = FeeCalcInfo;

export type PriceFetcher = {
    getPrice: (tokenType: TokenType) => Promise<number>;
    getPrices: (tokenTypes: TokenType[]) => Promise<number[]>;
}
