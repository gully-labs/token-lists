<!-- gully-header:start -->
<p align="center">
  <a href="https://gullychain.xyz">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/gullychain-wordmark-for-dark-bg.png">
      <img alt="Gully Chain" src=".github/assets/gullychain-wordmark-for-light-bg.png" width="360">
    </picture>
  </a>
</p>

<p align="center"><b>The social chain where your profile is your wallet. Arbitrum Orbit L3, testnet chain 485590.</b></p>

<p align="center">The Token Lists spec and schema behind the Gully Chain token list.</p>

<p align="center">
  <a href="https://gullychain.xyz"><img src="https://img.shields.io/badge/gullychain.xyz-01D9FA?style=for-the-badge&labelColor=000000&logo=googlechrome&logoColor=000000" alt="Website"></a>
  <a href="https://docs.gullychain.xyz"><img src="https://img.shields.io/badge/Docs-0A0F1A?style=for-the-badge&labelColor=000000&logo=readthedocs&logoColor=01D9FA" alt="Docs"></a>
  <a href="https://t.me/GullyChain"><img src="https://img.shields.io/badge/Telegram-0A0F1A?style=for-the-badge&labelColor=000000&logo=telegram&logoColor=26A5E4" alt="Telegram"></a>
  <a href="https://discord.com/invite/tY2ErsNNBp"><img src="https://img.shields.io/badge/Discord-0A0F1A?style=for-the-badge&labelColor=000000&logo=discord&logoColor=5865F2" alt="Discord"></a>
  <a href="https://x.com/Gully_Labs"><img src="https://img.shields.io/badge/@Gully__Labs-0A0F1A?style=for-the-badge&labelColor=000000&logo=x&logoColor=white" alt="X"></a>
</p>

<p align="center"><sub>A Gully Chain fork of <a href="https://github.com/Uniswap/token-lists">Uniswap/token-lists</a>, maintained by <a href="https://gullylabs.xyz">Gully Labs</a>. It is used under its MIT licence; the upstream LICENSE, copyright and attribution notices are kept unchanged. The upstream README follows below as published. Not affiliated with or endorsed by Uniswap.</sub></p>

---
<!-- gully-header:end -->

# Gully Chain token lists

[![Gully lists](https://github.com/gully-labs/token-lists/actions/workflows/gully-lists.yml/badge.svg)](https://github.com/gully-labs/token-lists/actions/workflows/gully-lists.yml)

Token lists for **Gully Chain** (Arbitrum Orbit L3; testnet chain id **485590**) in the
[Uniswap token-lists](https://github.com/Uniswap/token-lists) format, validated against the `@uniswap/token-lists`
1.0.0-beta.35 JSON schema. This repo is a fork of Uniswap/token-lists (MIT): the schema and its TypeScript package are
unchanged below; the Gully lists, logos and tools are in `lists/`, `logos/` and `gully/`.

| List | URL | File |
|---|---|---|
| **Gully Chain** (default, curated) | https://gullychain.xyz/tokenlist.json | [`lists/gully.tokenlist.json`](lists/gully.tokenlist.json) |
| **Gully Chain Extended** (plus Gully Core launches and active legacy launchpad tokens) | https://gullychain.xyz/tokenlist-extended.json | [`lists/gully-extended.tokenlist.json`](lists/gully-extended.tokenlist.json) |
| Logos | `https://gullychain.xyz/tokens/logos/485590/<address>.png\|svg` | [`logos/485590/`](logos/485590) |

All three are served with `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=300`, so any web app can
fetch them. Raw GitHub URLs work too (`https://raw.githubusercontent.com/gully-labs/token-lists/main/lists/gully.tokenlist.json`).

## What is on the default list

| Token | Address | Notes |
|---|---|---|
| WETH (Wrapped Ether) | `0x26aCCCb2e98ca9e067E58668Aa3B101beF432754` | WETH9, used by Gully Swap, Uniswap v3 and the launchpad. Tag `wrapped` |
| gETH (Gully Bridged ETH) | `0x7Dd1Aa3d8598A3edB43EB43ddcb5BCE4AbfBb702` | Hyperlane warp route; native ETH locked on Arbitrum Sepolia (`bridgeInfo` 421614) |
| USDC.e (Bridged USDC (Gully Labs)) | `0x65Ba03c6FA90Ed549f465D4c8f2e784D6eEB7E76` | Circle Bridged USDC Standard; Circle USDC on Arbitrum Sepolia (`bridgeInfo` 421614) |
| FROG, MOSS, LABRAT | see the list | legacy launchpad test tokens (tags `launchpad`, `legacy`) |

The Arbitrum token-bridge WETH (`0x3292dE74305DF64dbe082c6834fa841353eB2415`, also symbol WETH, supply 0) is
deliberately not listed: one WETH per list. Use WETH9 to wrap ETH and gETH for bridged ETH.

## Use the list

**Uniswap-style interfaces (Gully Swap, any Uniswap fork):** Manage tokens → Lists → paste
`https://gullychain.xyz/tokenlist.json` (or the extended URL) → Import.

**Wallets:** most wallets that read token lists (Rabby, Rainbow, Zerion and others) pick tokens from lists they track;
for a single token, add it by address on network Gully Chain Testnet (chain id 485590, RPC https://testnet-rpc.gullychain.xyz).
MetaMask: Import tokens → paste the address (symbol and decimals fill in).

**dApps:**

```js
const LIST = 'https://gullychain.xyz/tokenlist.json';
const list = await fetch(LIST).then((r) => r.json());             // CORS *, cached 5 minutes
const tokens = list.tokens.filter((t) => t.chainId === 485590);
```

Bundle a copy of the list as a fallback for when the fetch fails, and check `version` to pick up updates. With
`@uniswap/token-lists` you can diff versions (`diffTokenLists`, `minVersionBump`).

## Add a token

See [CONTRIBUTING.md](CONTRIBUTING.md): a PR that adds the address and tags to `gully/config.json` plus a logo; the
build reads name, symbol and decimals from the chain, CI checks everything again. Gully Core launches join the extended
list on their own (tag `gullycore`, "Launched on Gully Core", logo = the on-chain ipfs icon) once their liquidity lock
verifies on chain; legacy launchpad tokens once active.

## Build and validate

```sh
cd gully/tools && npm ci
node build.mjs                 # chain + indexer -> lists/*.json (version + timestamp set for you)
python logos.py                # logos for tokens that have none yet (launch image, else a generated mark), then build again
npm test                       # node:test unit tests + the committed lists
node validate.mjs --onchain    # schema (ajv) + duplicate/checksum/logo checks + name/symbol/decimals read back from chain
```

`build.mjs` fails on duplicates, bad checksums, a missing logo, schema errors or a token without contract code; the
versioning follows the spec (major on removal, minor on addition, patch on metadata). The sources are all public:
RPC `https://testnet-rpc.gullychain.xyz`, indexer `https://indexer.gullychain.xyz/tokens`, Gully Security
`https://gullylabs.xyz/api/security/reports`. Nothing in this repo needs a key; never commit one.

Publishing: gully-ops (`l3/tokenlist/sync.mjs`) copies `lists/` and `logos/` from this repo into the gullychain.xyz site
build, so every landing deploy serves the current lists.

## tokenlists.org

To get the lists on [tokenlists.org](https://tokenlists.org), open a PR on
[Uniswap/tokenlists-org](https://github.com/Uniswap/tokenlists-org) adding an entry to `src/token-lists.json`:

```json
"https://gullychain.xyz/tokenlist.json": { "name": "Gully Chain", "homepage": "https://gullychain.xyz" }
```

---

# Upstream: @uniswap/token-lists


[![Tests](https://github.com/Uniswap/token-lists/workflows/Tests/badge.svg)](https://github.com/Uniswap/token-lists/actions?query=workflow%3ATests)
[![npm](https://img.shields.io/npm/v/@uniswap/token-lists)](https://unpkg.com/@uniswap/token-lists@latest/)

This package includes a JSON schema for token lists, and TypeScript utilities for working with token lists.

The JSON schema represents the technical specification for a token list which can be used in a dApp interface, such as the Uniswap Interface.

## What are token lists?

Uniswap Token Lists is a specification for lists of token metadata (e.g. address, decimals, ...) that can be used by any dApp interfaces that needs one or more lists of tokens.

Anyone can create and maintain a token list, as long as they follow the specification.

Specifically an instance of a token list is a [JSON](https://www.json.org/json-en.html) blob that contains a list of 
[ERC20](https://github.com/ethereum/eips/issues/20) token metadata for use in dApp user interfaces.
Token list JSON must validate against the [JSON schema](https://json-schema.org/) in order to be used in the Uniswap Interface.
Tokens on token lists, and token lists themselves, are tagged so that users can easily find tokens.

## JSON Schema $id

The JSON schema ID is [https://uniswap.org/tokenlist.schema.json](https://uniswap.org/tokenlist.schema.json)

## Validating token lists

This package does not include code for token list validation. You can easily do this by including a library such as 
[ajv](https://ajv.js.org/) to perform the validation against the JSON schema. The schema is exported from the package
for ease of use.

```typescript

import { schema } from '@uniswap/token-lists'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import fetch from 'node-fetch'

const ARBITRUM_LIST = 'https://bridge.arbitrum.io/token-list-42161.json'

async function validate() {
  const ajv = new Ajv({ allErrors: true, verbose: true })
  addFormats(ajv)
  const validator = ajv.compile(schema);
  const response = await fetch(ARBITRUM_LIST)
  const data = await response.json()
  const valid = validator(data)
  if (valid) {
    return valid
  }
  if (validator.errors) {
    throw validator.errors.map(error => {
      delete error.data
      return error
    })
  }
}

validate()
  .then(console.log("Valid List."))
  .catch(console.error)

```

## Authoring token lists

### Manual

The best way to manually author token lists is to use an editor that supports JSON schema validation. Most popular
code editors do, such as [IntelliJ](https://www.jetbrains.com/help/idea/json.html#ws_json_schema_add_custom) or 
[VSCode](https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings). Other editors
can be found [here](https://json-schema.org/implementations.html#editors).

The schema is registered in the [SchemaStore](https://github.com/SchemaStore/schemastore), and any file that matches
the pattern `*.tokenlist.json` should 
[automatically utilize](https://www.jetbrains.com/help/idea/json.html#ws_json_using_schemas) 
the JSON schema for the [supported text editors](https://www.schemastore.org/json/#editors).

In order for your token list to be able to be used, it must pass all JSON schema validation.

### Automated

If you want to automate token listing, e.g. by pulling from a smart contract, or other sources, you can use this
npm package to take advantage of the JSON schema for validation and the TypeScript types.
Otherwise, you are simply working with JSON. All the usual tools apply, e.g.:

```typescript
import { TokenList, schema } from '@uniswap/token-lists'

// generate your token list however you like.
const myList: TokenList = generateMyTokenList();

// use a tool like `ajv` to validate your generated token list
validateMyTokenList(myList, schema);

// print the resulting JSON to stdout
process.stdout.write(JSON.stringify(myList));
```

## Semantic versioning

Lists include a `version` field, which follows [semantic versioning](https://semver.org/).

List versions must follow the rules:

- Increment major version when tokens are removed
- Increment minor version when tokens are added
- Increment patch version when tokens already on the list have minor details changed (name, symbol, logo URL, decimals)

Changing a token address or chain ID is considered both a remove and an add, and should be a major version update.

Note that list versioning is used to improve the user experience, but not for security, i.e. list versions are not meant
to provide protection against malicious updates to a token list; i.e. the list semver is used as a lossy compression
of the diff of list updates. List updates may still be diffed in the client dApp.

## Deploying your list

Once you have authored the list, you can make it available at any URI. Prefer pinning your list to IPFS 
(e.g. via [pinata.cloud](https://pinata.cloud)) and referencing the list by an ENS name that resolves to the 
[contenthash](https://eips.ethereum.org/EIPS/eip-1577).

If hosted on HTTPS, make sure the endpoint is configured to send an access-control-allow-origin header to avoid CORS errors.

### Linking an ENS name to the list

An ENS name can be assigned to an IPFS hash via the [contenthash](https://eips.ethereum.org/EIPS/eip-1577) text record.
This is the preferred way of referencing your list.

## Examples

You can find a simple example of a token list in [test/schema/example.tokenlist.json](test/schema/example.tokenlist.json).

A snapshot of the Uniswap default list encoded as a token list is found in [test/schema/bigexample.tokenlist.json](test/schema/bigexample.tokenlist.json).


<!-- gully-footer:start -->
---

<p align="center">
  <a href="https://gullylabs.xyz">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/powered-by-gully-labs-dark-2x.png">
      <img alt="Powered by Gully Labs" src=".github/assets/powered-by-gully-labs-light-2x.png" width="254" height="64">
    </picture>
  </a>
</p>
<!-- gully-footer:end -->
