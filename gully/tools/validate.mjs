#!/usr/bin/env node
// Validates lists/*.tokenlist.json (or the files given as arguments): the @uniswap/token-lists schema (ajv), then
// checkList (duplicate addresses or symbols, EIP-55 checksums, chain id, defined tags, logo files present and named
// logos/<chainId>/<address>.png|svg, logo size). With --onchain it also reads every token from the Gully Chain RPC and
// fails on missing code or a name/symbol/decimals mismatch. With --previous <dir> it checks the version bump against the
// lists in <dir> (CI passes the base branch's lists).
//   node validate.mjs [--onchain] [--previous <dir>] [file ...]
import { existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createPublicClient, http, parseAbi } from 'viem';
import { LISTS, LISTS_DIR, LOGOS_DIR, loadConfig, loadJson, checkList, nextVersion, vstr } from './lib.mjs';
import { validateSchema } from './schema.mjs';

const args = process.argv.slice(2);
const ONCHAIN = args.includes('--onchain');
const pi = args.indexOf('--previous');
const PREV_DIR = pi >= 0 ? args[pi + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && !(pi >= 0 && i === pi + 1));
const targets = files.length ? files : Object.values(LISTS).map((l) => join(LISTS_DIR, l.file));
const cfg = loadConfig();
const ERC20 = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)']);
const client = ONCHAIN ? createPublicClient({ transport: http(process.env.GULLY_RPC_URL || cfg.rpcUrl, { timeout: 20_000, retryCount: 2 }) }) : null;
const MAX_LOGO = 200 * 1024;

let bad = 0;
for (const file of targets) {
  const list = loadJson(file);
  const errs = [...validateSchema(list), ...checkList(list, {
    chainId: cfg.chainId, logoBaseUrl: cfg.logoBaseUrl,
    logoExists: (rel) => { const p = join(LOGOS_DIR, rel); return existsSync(p) && statSync(p).size <= MAX_LOGO; },
  })];
  if (client) {
    const cid = await client.getChainId();
    if (cid !== cfg.chainId) errs.push(`RPC is chain ${cid}, expected ${cfg.chainId}`);
    for (const t of list.tokens) {
      try {
        const code = await client.getCode({ address: t.address });
        if (!code || code === '0x') { errs.push(`${t.symbol} ${t.address}: no contract code on chain`); continue; }
        const [name, symbol, decimals] = await Promise.all(['name', 'symbol', 'decimals'].map((functionName) => client.readContract({ address: t.address, abi: ERC20, functionName })));
        if (name !== t.name) errs.push(`${t.symbol} ${t.address}: name "${t.name}" but the contract says "${name}"`);
        if (symbol !== t.symbol) errs.push(`${t.symbol} ${t.address}: symbol "${t.symbol}" but the contract says "${symbol}"`);
        if (Number(decimals) !== t.decimals) errs.push(`${t.symbol} ${t.address}: decimals ${t.decimals} but the contract says ${decimals}`);
      } catch (e) { errs.push(`${t.symbol} ${t.address}: on-chain read failed: ${e.shortMessage || e.message}`); }
    }
  }
  if (PREV_DIR) {
    const pf = join(PREV_DIR, basename(file));
    if (existsSync(pf)) {
      const prev = loadJson(pf);
      const want = nextVersion(prev, list);
      const cmp = (a, b) => a.major - b.major || a.minor - b.minor || a.patch - b.patch;
      if (cmp(list.version, want) < 0) errs.push(`version ${vstr(list.version)} is too low: the changes since ${vstr(prev.version)} need at least ${vstr(want)}`);
      if (vstr(list.version) !== vstr(prev.version) && list.timestamp === prev.timestamp) errs.push('version changed but timestamp did not');
    }
  }
  if (errs.length) { bad++; console.error(`FAIL ${basename(file)} (${errs.length})\n  ${errs.join('\n  ')}`); }
  else console.log(`ok   ${basename(file)}: ${list.tokens.length} tokens, version ${vstr(list.version)}${ONCHAIN ? ', on-chain checked' : ''}`);
}
process.exit(bad ? 1 : 0);
