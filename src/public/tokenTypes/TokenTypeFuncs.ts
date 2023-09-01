import { Cluster, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { TokenInfo, TokenType, TokenTypeArr } from './TokenType.js';
import { INVALID_TOKEN_TYPE } from '../../constants.js';
import { tokenInfos } from './Token.js';

/**
 * Gets the TokenInfo of a token type
 * @param tokenType The token type for which to get the denomination
 * @returns The Token Info of the token type
 */
export function getTokenInfo(tokenType: TokenType): TokenInfo {
    const tokenIndex = getNumberFromTokenType(tokenType);
    if (tokenIndex >= tokenInfos.length) throw new Error(INVALID_TOKEN_TYPE);
    return tokenInfos[getNumberFromTokenType(tokenType)];
}

/**
 * Gets all token types
 * @returns The list of all token types
 */
export function getTokenTypes(): TokenType[] {
    return tokenInfos.map((tokenInfo) => tokenInfo.symbol);
}

/**
 * Get the mint for a certain token type
 * @param tokenType The token type for which to get the mint account
 * @param cluster The cluster on which to get the mint (e.g. 'devnet')
 * @returns The PublicKey of the token's mint
 */
export function getMintAccount(tokenType: TokenType, cluster: Cluster): PublicKey {
    const tokenInfo = getTokenInfo(tokenType);
    switch (cluster) {
        case 'devnet': return tokenInfo.mintDevnet;
        case 'mainnet-beta': return tokenInfo.mintMainnet;
        default: throw new Error('Unknown Cluster');
    }
}

export function getDenomination(t: TokenType): number {
    return getTokenInfo(t).denomination;
}

/**
 * Returns the token type associated with a 16 bit uint. Analog to {@link getNumberFromTokenType}
 * @param t The number to get the token type of
 * @returns The token type associated with the number
 */
export function getTokenTypeFromNumber(t: number): TokenType {
    if (t >= TokenTypeArr.length) throw new Error(INVALID_TOKEN_TYPE);
    return TokenTypeArr[t];
}

/**
 * Returns the number associated with a token type as a 16 bit uint. Analog to {@link getTokenTypeFromNumber}
 * @param t The token type to get the number of
 * @returns The number associated with the token type
 */
export function getNumberFromTokenType(t: TokenType): number {
    const n = TokenTypeArr.indexOf(t);
    if (n !== -1) return n;
    throw new Error(INVALID_TOKEN_TYPE);
}

export function getTokenTypeFromStr(t: string): TokenType {
    if (getNumberFromTokenType(t as TokenType) !== -1) return t as TokenType;
    throw new Error(INVALID_TOKEN_TYPE);
}

export function getAssociatedTokenAcc(pk: PublicKey, t: TokenType, cluster: Cluster, allowOwnerOffCurve = false): PublicKey {
    if (t === 'LAMPORTS') return pk;
    const mint = getMintAccount(t, cluster);
    try {
        return getAssociatedTokenAddressSync(mint, pk, allowOwnerOffCurve);
    }
    catch (e) {
        if (e instanceof Error && e.name === 'TokenOwnerOffCurveError') {
            throw new Error('TokenOwnerOffCurveError: Please pass the owner account instead of the ATA account or set allowOwnerOffCurve to true if this was intended');
        }
        throw e;
    }
}

export function getPythPriceAccount(t: TokenType, cluster: Cluster): PublicKey {
    const tokenInfo = getTokenInfo(t);
    switch (cluster) {
        case 'devnet': return tokenInfo.pythUSDPriceDevnet;
        case 'mainnet-beta': return tokenInfo.pythUSDPriceMainnet;
        default: throw new Error('Unknown Cluster');
    }
}

export function getPythPriceAcc(tokenType: TokenType, cluster: Cluster): PublicKey {
    const tI = getTokenInfo(tokenType);
    if (cluster === 'mainnet-beta') return tI.pythUSDPriceMainnet;
    if (cluster === 'devnet') return tI.pythUSDPriceDevnet;
    throw new Error('Invalid cluster');
}
