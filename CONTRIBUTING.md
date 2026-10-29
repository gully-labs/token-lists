# Adding a token to the Gully Chain token list

The Gully Chain lists follow the [Uniswap token-lists](https://github.com/Uniswap/token-lists) standard. There are two:

| List | URL | What is on it |
|---|---|---|
| Default (curated) | `https://gullychain.xyz/tokenlist.json` | WETH9, the stablecoins, bridged assets and tokens reviewed in a PR here |
| Extended | `https://gullychain.xyz/tokenlist-extended.json` | the default list plus every Gully Core launch whose liquidity lock verifies on chain, and the legacy launchpad tokens that pass the activity filter |

**You do not need a PR for the extended list.** A token launched on **Gully Core** (the Gully Chain launchpad) joins it
at the next build once LaunchpadKitV2 knows it (`getLaunch(token).createdAt != 0`), every pool's liquidity is verified
locked on chain (kit `legsOf` / `getLeg` -> LP locker `isLocked` and `getLock.poolId`), and its metadata has an ipfs icon.
Its `logoURI` is that icon through the Gully Labs gateway (`https://ipfs.gullylabs.xyz/ipfs/<cid>`), tag `gullycore`.
When the indexer already has the token, the activity filter below applies too.

Tokens of the legacy launchpads (before Gully Core) join once the indexer shows at least `minHolders` holders and
`minTxns` trades (see `gully/config.json`), or once they graduate to a Gully Swap pool; they are tagged `legacy`.
Either way a published Gully Security report with critical or high findings keeps a token out.

**The default list takes a PR.** One token per PR; open it with the
[add-token template](.github/PULL_REQUEST_TEMPLATE/add-token.md) (`?template=add-token.md` on the compare page).

## Requirements

1. **Verified source.** The contract is verified on the Gully Chain explorer (verify.gullychain.xyz once it is live;
   testnet-explorer.gullychain.xyz today).
2. **Standard ERC-20.** No transfer tax, blocklist, pausable transfers or owner minting after launch, unless the PR says
   why (a regulated stablecoin, for example).
3. **Liquidity and holders.** At least 0.05 ETH of liquidity in a Gully Swap pool (or graduated from DeepCore) and at
   least 25 holders.
4. **No Gully Security flag.** No published report with critical or high findings at
   `https://gullylabs.xyz/api/security/reports`.
5. **Logo.** `logos/485590/<checksummed address>.png`: square, 256x256 PNG (or a square SVG with no scripts or external
   references), under 100 KB, your own artwork, no third-party trademarks. Without one, `python gully/tools/logos.py`
   uses the launch image or draws a plain monogram mark.

## Steps

```sh
git clone https://github.com/<you>/token-lists && cd token-lists/gully/tools
npm ci
# 1. add { "address": "0x...", "tags": ["launchpad"] } to "curated" in gully/config.json
#    (address and tags only: name, symbol and decimals are read from the chain, never typed in)
# 2. add the logo at logos/485590/<address>.png
node build.mjs            # reads the chain + indexer, bumps the version, writes lists/*.json
npm test                  # unit tests + the committed lists
node validate.mjs --onchain
git add gully/config.json logos lists && git commit -m "Add <SYMBOL>"
```

CI (`.github/workflows/gully-lists.yml`) runs the same checks on every PR, reads every token back from the chain, and
checks the version bump against `main`. Do not edit `version` or `timestamp` by hand: `build.mjs` sets them (major on a
removal, minor on an addition, patch on a metadata change; the timestamp moves only with the version).

## Tags

| id | Meaning |
|---|---|
| `wrapped` (name "native wrapped") | WETH9, unwraps 1:1 to ETH |
| `stablecoin` | tracks the US dollar |
| `bridged` | bridged from Arbitrum Sepolia; `extensions.bridgeInfo` names the origin token |
| `gullycore` (name "gully core") | Launched on Gully Core |
| `legacy` (name "legacy launchpad") | launched on a legacy Gully Chain launchpad, before Gully Core |
| `launchpad` | launched on a Gully Chain launchpad (legacy tokens carry it with `legacy`) |
| `graduated` | graduated from the bonding curve to a Gully Swap pool |

Tag ids follow the schema (at most 10 word characters), so "native-wrapped" is the display name of `wrapped`,
"gully-core" is `gullycore` and "legacy-launchpad" is `legacy`.

## Removing a token

Open a PR that removes it from `curated` (or adds it to `excluded` with a reason) and rebuild: the version gets a major
bump. Report a scam token to the Gully Security team on Telegram (t.me/GullyChain) or in a GitHub issue here.
