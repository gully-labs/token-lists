## Add a token to the Gully Chain token list

<!-- Use with ?template=add-token.md. One token per PR. See CONTRIBUTING.md. -->

**Token address (Gully Chain, 485590):** `0x...`
**Symbol / name (as the contract returns them):**
**List:** default (curated) / extended
**Project website / socials:**

### Checks (all must be true)

- [ ] The contract's source is verified on the Gully Chain explorer (verify.gullychain.xyz once live; testnet-explorer.gullychain.xyz today)
- [ ] It is a standard ERC-20 (no transfer tax, no blocklist, no owner mint after launch) or the PR explains why not
- [ ] Liquidity: at least 0.05 ETH in a Gully Swap pool, or graduated from the DeepCore launchpad
- [ ] At least 25 holders (extended list: the indexer filter in `gully/config.json` applies instead)
- [ ] No published Gully Security report with critical or high findings for this address
- [ ] Logo added at `logos/485590/<checksummed address>.png` (256x256 PNG, or SVG; square; under 100 KB; your own artwork, no third-party trademarks)
- [ ] Entry added to `curated` in `gully/config.json` (address and tags only: name, symbol and decimals are read from the chain)
- [ ] `cd gully/tools && npm ci && node build.mjs && npm test && node validate.mjs --onchain` passes, and the built `lists/*.json` are committed

### Version

`build.mjs` bumps it for you: minor for an added token. Do not edit `version` or `timestamp` by hand.
