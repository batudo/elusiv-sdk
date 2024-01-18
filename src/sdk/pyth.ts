import { PriceStatus, PythHttpClient, getPythProgramKeyForCluster } from '@pythnetwork/client';
import { Cluster, Connection } from '@solana/web3.js';
import { PriceFetcher } from '../public/types.js';
import { getPythPriceAcc } from '../public/tokenTypes/TokenTypeFuncs.js';
import { sleep } from './utils/utils.js';
import { TokenType } from '../public/tokenTypes/TokenType.js';

export function getPythPriceFetcher(conn: Connection, cluster: Cluster): PriceFetcher {
    const pythPublicKey = getPythProgramKeyForCluster(cluster);
    const pythClient = new PythHttpClient(conn, pythPublicKey);
    const maxRetries = 5;
    const msBetweenRetries = 200;

    const getPrices = async (tokens: TokenType[]) => {
        const priceAccs = tokens.map((t) => getPythPriceAcc(t, cluster));

        for (let i = 0; i < maxRetries; i++) {
            // eslint-disable-next-line no-await-in-loop
            const prices = await pythClient.getAssetPricesFromAccounts(priceAccs);
            if (prices.some((price) => price.price === undefined || price.status === PriceStatus.Halted || price.status === PriceStatus.Unknown)) {
                // eslint-disable-next-line no-console
                console.warn(`Failed to fetch Pyth Data, retrying ${i}/${maxRetries}`);
                // eslint-disable-next-line no-await-in-loop
                await sleep(msBetweenRetries);
            }
            else {
                // We can assert price to be true here because we checked in the if statement above, typescript just isn't smart enough to understand this
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return prices.map((price) => price.price!);
            }
        }
        throw new Error('Failed to fetch/parse pyth data, this usually means the price is undefined or the status is not trading');
    };

    return {
        getPrices,
        getPrice: async (token: TokenType) => {
            const prices = await getPrices([token]);
            return prices[0];
        },
    };
}
