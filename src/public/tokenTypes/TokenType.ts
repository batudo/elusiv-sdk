import { PublicKey } from '@solana/web3.js';

/**
 * Array representing all currently supported tokens.
 */
export const TokenTypeArr = ['LAMPORTS', 'USDC', 'USDT', 'mSOL', 'BONK', 'SAMO', 'stSOL', 'ORCA', 'RAY', 'PYTH'] as const;

/**
 * Enum representing the currently supported tokens to be sent via Elusiv, derived from {@link TokenTypeArr}.
 */
export type TokenType = typeof TokenTypeArr[number];

/**
 * Type representing all relevant info for a specific token type
 */
export type TokenInfo = {
    symbol: TokenType,
    mintMainnet: PublicKey,
    mintDevnet: PublicKey,
    active: boolean,
    decimals: number,
    /**
     * Min amount we can send on Elusiv (given in the smallest unit of the token)
     */
    min: number,
    /**
     * Max amount we can send on Elusiv (given in the smallest unit of the token)
     */
    max: number,
    denomination: number,
    pythUSDPriceMainnet: PublicKey,
    pythUSDPriceDevnet: PublicKey,
}
