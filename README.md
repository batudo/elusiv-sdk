<div align="center">
  <img src="https://github.com/elusiv-privacy/.github/blob/main/profile/elusiv.svg" />

  <h1>Elusiv</h1>
   <p>
    <a href="https://elusiv-privacy.github.io/elusiv-sdk/"><img alt="Docs" src="https://img.shields.io/badge/docs-typedoc-blueviolet" /></a>
 </p>
</div>

Elusiv - Add on-chain privacy to your dApp with just a few lines of code.

If you have any questions about the SDK, join our [Discord](https://discord.gg/elusivprivacy) to get help. If you want to learn more about the core protocol, check out our [core docs](https://docs.elusiv.io). 

## Quick Setup

### 1. Install

npm:
```shell
npm i @elusiv/sdk
```

### (1.5 Optional)

Ensure `process.browser` is set. Depending on your environment, this might require a polyfill. You can verify this by trying to run `console.log(process.browser)` within your top-level app and ensuring it returns a truthy value.

### 2. Basic Usage

```ts
// We sign using an external library here because there is no wallet connected. Usually you'd use the solana wallet adapter instead.
import { sign } from '@noble/ed25519';
import { Connection, Keypair } from '@solana/web3.js';
import { Elusiv, SEED_MESSAGE } from '@elusiv/sdk';


const userKp = Keypair.generate();

// Generate the input seed. Remember, this is almost as important as the private key, so don't log this!
// (Slice because in Solana's keypair type the first 32 bytes is the privkey and the last 32 is the pubkey)
const seed = await sign(
    Buffer.from(SEED_MESSAGE, 'utf-8'),
    userKp.secretKey.slice(0, 32),
);

// Create the elusiv instance
const elusiv = await Elusiv.getElusivInstance(seed, userKp.publicKey, new Connection('https://api.devnet.solana.com'), 'devnet');

// Top up our private balance with 1 SOL (= 1_000_000_000 Lamports)
const topupTxData = await elusiv.buildTopUpTx(LAMPORTS_PER_SOL, 'LAMPORTS');
// Sign it (only needed for topups, as we're topping up from our public key there)
topupTx.tx.partialSign(keyPair);
// Send it off
const topupSig = await elusiv.sendElusivTx(topupTxData);

// Send half a SOL, privately 😎
const recipient = Keypair.generate().publicKey;
const sendTx = await elusiv.buildSendTx(0.5 * LAMPORTS_PER_SOL, recipient, 'LAMPORTS');
// No need to sign as we prove ownership of the private funds using a zero knowledge proof
const sendSig = await elusiv.sendElusivTx(sendTx);

console.log(`Performed topup with sig ${topupSig.signature} and send with sig ${sendSig.signature}`);
```

If you get the error `etc.sha512Sync` not set, change the following code in the above sample:

```ts 
import * as ed, { sign } from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))
```

### More advanced usage

The main idea of Elusiv is that you have a private balance on-chain, from which you can send money and receive money into while maintaining your privacy i.e. without anyone being able to see your associated public key. Therefore, the two core operations you can perform on your private balance is topping it up with funds and sending funds from your private balance (like showcased above). From there, you can compose these operations with other DeFi operations to build more capable private dApps.

The main flow to make a DeFi action private that takes asset `A` as an input and produces asset `B` as an output (for example a swap) generally goes:

0. (Assume the user has a private balance already. If not, give them an option to create one.)
1. Derive a determinstic one-time burner keypair K using [deriveKeyExternal](https://elusiv-privacy.github.io/elusiv-sdk/classes/Elusiv.html#deriveKeyExternal)
2. Perform private send to K for asset A
3. Perform DeFi operation that takes in A and returns B using K (e.g. swapping token A for token B)
4. Topup B to private balance

### Templates and samples
These templates should assist you in serving as a nice base to writing your first private dApp using Elusiv:

| package                                                                        | description                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [General Samples](https://github.com/elusiv-privacy/elusiv-samples) | Samples showcasing general capabilities of Elusiv |
| [Frontend/Webpack](https://github.com/elusiv-privacy/elusiv-webpack-demo) | React.js template, useful for seeing what polyfills might be needed in a frontend app |

