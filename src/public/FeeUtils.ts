import { getDenomination, getTokenInfo } from './tokenTypes/TokenTypeFuncs.js';
import { zipSameLength } from '../sdk/utils/utils.js';
import { TokenType } from './tokenTypes/TokenType.js';
import { BasicFee, Fee, PriceFetcher } from './types.js';

// Default precision is 9 due to 1 SOL = 10^9 Lamports
const DEFAULT_PRECISION = 9;

// This is the buffer multiplier we use to account for price fluctuations
const FEE_BUFFER_MULTIPLIER = 1.02;

export class FeeUtils {
    /**
     * Converts a lamport fee to a token fee. Important note: This adds 2% to the fee amount when using a token type other than lamports
     * to account for any potential price fluctuations to ensure the tx goes through.
     * @param lamportFee Fee in lamports
     * @param tokenType Token type to convert to
     * @param lamportsPerToken The amount of lamports per token
     * @returns The fee in the token type
     */
    public static lamportFeeToTokenFee(
        lamportFee: BasicFee,
        tokenType: TokenType,
        lamportsPerToken: number,
        extraFeeInToken: number,
    ): Fee {
        if (lamportFee.tokenType !== 'LAMPORTS') throw new Error('Expected fee in lamports');
        return {
            tokenType,
            txFee: FeeUtils.lamportFeeAmountToTokenFeeAmount(lamportFee.txFee, tokenType, lamportsPerToken),
            privacyFee: FeeUtils.lamportFeeAmountToTokenFeeAmount(lamportFee.privacyFee, tokenType, lamportsPerToken),
            tokenAccRent: FeeUtils.lamportFeeAmountToTokenFeeAmount(lamportFee.tokenAccRent, tokenType, lamportsPerToken),
            lamportsPerToken,
            extraFee: extraFeeInToken,
        };
    }

    /**
     * Fee amounts get buffered with an extra 2% to account for price fluctuations
     * @param lamportFee
     * @param tokenType
     * @param lamportsPerToken
     * @returns
     */
    public static lamportFeeAmountToTokenFeeAmount(
        lamportFee: number,
        tokenType: TokenType,
        lamportsPerToken: number,
    ): number {
        const bufferMultiplier = tokenType === 'LAMPORTS' ? 1 : FEE_BUFFER_MULTIPLIER;
        const tokenAmount = FeeUtils.lamportsToToken(lamportFee, lamportsPerToken);
        return Math.ceil(tokenAmount * bufferMultiplier);
    }

    public static async getLamportsPerToken(priceFetcher: PriceFetcher, tokenType: TokenType): Promise<number> {
        if (tokenType === 'LAMPORTS') return 1;
        const priceData = await FeeUtils.fetchPrices(priceFetcher, ['LAMPORTS', tokenType]);
        // USD/T / USD/L  = USD/T * L/USD = L/T
        return priceData[1] / priceData[0];
    }

    public static tokenToLamports(tokenAmount: number, lamportsPerToken: number): number {
        if (lamportsPerToken === 0) return 0;
        return tokenAmount * lamportsPerToken;
    }

    public static lamportsToToken(lamportAmount: number, lamportsPerToken: number, precision = DEFAULT_PRECISION): number {
        if (lamportsPerToken === 0) return 0;
        // L / (L/T) = L * (T/L) = T
        return Number.parseFloat((lamportAmount / lamportsPerToken).toFixed(precision));
    }

    private static async fetchPrices(priceFetcher: PriceFetcher, tokens: TokenType[]): Promise<number[]> {
        const prices = await priceFetcher.getPrices(tokens);
        return zipSameLength(prices, tokens).map(({ fst: price, snd: token }) => price / getDenomination(token));
    }
}

/**
 * Returns the minimum amount of tokens we can send/topup with Elusiv. This function is needed as the minimum amount we can send is the largest out of either
 * 1) TokenInfo.min
 * 2) The amount of tokens needed to pay for the rent of the token account in that tokentype
 * The reason it is like this is because token prices fluctuate, so the static amount in TokenInfo.minAmount might not always be
 * correct, so this function is the way to go
 * @param tokenAccRentInTokenType The token type we want to get the minimum amount for in the tokenType (i.e. in USDC, not in lamports if we're sending USDC)
 * @param tokenAccRentLamports The rent-exempt amount in lamports needed for a token account
 * @returns The minimum amount of tokens of said tokentype we can send/topup with Elusiv
 */
export function getMinimumAmount(tokenType: TokenType, lamportsPerToken: number, tokenAccRentInLamports: number): number {
    const minRent = FeeUtils.lamportFeeAmountToTokenFeeAmount(tokenAccRentInLamports, tokenType, lamportsPerToken);
    // No buffer for lamports
    return Math.max(getTokenInfo(tokenType).min, minRent);
}
