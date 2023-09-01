import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { INVALID_CONVERSION_RATE, INVALID_TOKEN_TYPE } from '../constants.js';
import { FeeUtils } from '../sdk/paramManagers/fee/FeeUtils.js';
import { TokenType } from './tokenTypes/TokenType.js';
import { Fee } from './types.js';

/** Get the total amount of fees to be paid in the tokentype of the fee, rounded up (includes the potential token account rent)
 * @param f The fee to get the total amount of
 * @returns The total amount of fees to be paid in the tokentype of the fee, rounded up (including the potential token account rent)
 * */
export function getTotalFeeAmount(f: Fee): number {
    return Math.ceil(getComputationFeeTotal(f) + f.tokenAccRent + f.extraFee);
}

/**
 * Get the total amount of fees to be paid in the tokentype of the fee, rounded up (NOT including the potential token account rent)
 * @param f The fee to get the total amount of
 * @returns The total amount of fees to be paid in the tokentype of the fee, rounded up (NOT including the potential token account rent)
 */
export function getComputationFeeTotal(f: Fee): number {
    return Math.ceil(f.privacyFee + f.txFee);
}

export function getTotalFeeAmountSol(f: Fee): number {
    if (f.lamportsPerToken === undefined) throw new Error(INVALID_CONVERSION_RATE);
    const total = getTotalFeeAmount(f);
    return FeeUtils.tokenToLamports(total, f.lamportsPerToken) / LAMPORTS_PER_SOL;
}

export function zeroFee(tokenType: TokenType): Fee {
    return {
        tokenType,
        txFee: 0,
        privacyFee: 0,
        extraFee: 0,
        tokenAccRent: 0,
    };
}

export function addFees(f1: Fee, f2: Fee): Fee {
    if (f1.tokenType !== f2.tokenType) {
        throw new Error(INVALID_TOKEN_TYPE);
    }
    if (
        f1.lamportsPerToken !== undefined && f2.lamportsPerToken !== undefined
        && f1.lamportsPerToken !== f2.lamportsPerToken
    ) {
        throw new Error(INVALID_CONVERSION_RATE);
    }

    return {
        tokenType: f1.tokenType,
        txFee: f1.txFee + f2.txFee,
        privacyFee: f1.privacyFee + f2.privacyFee,
        tokenAccRent: f1.tokenAccRent + f2.tokenAccRent,
        extraFee: f1.extraFee + f2.extraFee,
        lamportsPerToken: f1.lamportsPerToken || f2.lamportsPerToken,
    };
}
