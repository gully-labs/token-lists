#!/usr/bin/env node
// Builds lists/gully.tokenlist.json (default, curated) and lists/gully-extended.tokenlist.json (every launchpad token
// that passes the activity filter, plus the curated tokens) from gully/config.json, the Gully Chain RPC, the Gully Chain
// indexer and the public Gully Security reports. Every token is read on chain (code present; name, symbol, decimals from
// the contract, never typed in), every list is validated (schema + checkList) and the version is bumped from the
// committed copy: removed token = major, added = minor, metadata = patch. The timestamp changes only with the version.
//
//   cd gully/tools && npm ci && node build.mjs [--dry-run]
// Env (all optional): GULLY_RPC_URL, GULLY_INDEXER_URL override config.json. No keys needed: all endpoints are public.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';
import {
  LISTS, LISTS_DIR, LOGOS_DIR, TAGS, loadConfig, loadList, nextVersion, sortTokens, checkList, findLogo, launchImage,
  activeEnough, flaggedBySecurity, vstr,
} from './lib.mjs';
import { validateSchema } from './schema.mjs';

const cfg = loadConfig();
const DRY = process.argv.includes('--dry-run');
const RPC = process.env.GULLY_RPC_URL || cfg.rpcUrl;
const INDEXER = (process.env.GULLY_INDEXER_URL || cfg.indexerUrl).replace(/\/+$/, '');
const client = createPublicClient({ transport: http(RPC, { timeout: 20_000, retryCount: 2 }) });
const ERC20 = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)']);

const chainId = await client.getChainId();
if (chainId !== cfg.chainId) throw new Error(`RPC ${RPC} is chain ${chainId}, config says ${cfg.chainId}`);

async function getJson(url) {
  const ctl = AbortSignal.timeout(20_000);
  const r = await fetch(url, { signal: ctl, headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function onchain(address) {
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error(`${address}: no contract code on chain ${chainId}`);
  const [name, symbol, decimals] = await Promise.all(['name', 'symbol', 'decimals'].map((functionName) => client.readContract({ address, abi: ERC20, functionName })));
  return { name, symbol, decimals: Number(decimals) };
}

const notes = [];
const todo = []; // tokens without a logo file, for logos.py
const excluded = new Set((cfg.excluded || []).map((x) => x.address.toLowerCase()));

// Logos: logos/<chainId>/<address>.svg|png; a launch image is downloaded once (tools/logos.py converts webp etc. to png).
const logoURI = (address) => {
  const ext = findLogo(chainId, address);
  return ext ? `${cfg.logoBaseUrl}/${chainId}/${getAddress(address)}.${ext}` : null;
};

async function entry(address, tags, { extensions, bridgeInfo } = {}) {
  const a = getAddress(address);
  const m = await onchain(a);
  const t = { chainId, address: a, name: m.name, symbol: m.symbol, decimals: m.decimals };
  const logo = logoURI(a);
  if (logo) t.logoURI = logo;
  if (tags?.length) t.tags = [...new Set(tags)].sort();
  const ext = { ...(extensions || {}) };
  if (bridgeInfo) ext.bridgeInfo = Object.fromEntries(Object.entries(bridgeInfo).map(([c, v]) => [c, { tokenAddress: getAddress(v.tokenAddress) }]));
  if (Object.keys(ext).length) t.extensions = ext;
  return t;
}

// Indexer rows (launchpad tokens with activity, graduation and metadata)
let rows = [];
try { rows = (await getJson(`${INDEXER}/tokens`)).tokens || []; }
catch (e) { throw new Error(`indexer unreachable (${e.message}); the extended list needs it`); }
const byAddr = new Map(rows.map((r) => [r.address.toLowerCase(), r]));
const pads = new Map(cfg.launchpads.map((p) => [p.address.toLowerCase(), p]));

// Gully Security: published reports with critical/high findings exclude a token from the extended list.
let flagged = new Set();
try { flagged = flaggedBySecurity((await getJson(cfg.securityReportsUrl)).reports, chainId); }
catch (e) { notes.push(`Gully Security reports not read (${e.message}): no security exclusions applied`); }

const launchExt = (row) => {
  const pad = pads.get(String(row.launchpad || '').toLowerCase());
  const ext = { launchpad: getAddress(row.launchpad) };
  if (pad?.version || row.launchpadVersion) ext.launchpadVersion = String(pad?.version || row.launchpadVersion);
  if (row.pool) ext.pool = getAddress(row.pool);
  return ext;
};
const launchTags = (row) => (row.graduated ? ['launchpad', 'graduated'] : ['launchpad']);

// Curated (default list)
const curated = [];
for (const c of cfg.curated) {
  const row = byAddr.get(c.address.toLowerCase());
  const tags = [...c.tags];
  let extensions = c.extensions;
  if (tags.includes('launchpad') && row) { tags.splice(0, tags.length, ...launchTags(row)); extensions = { ...launchExt(row), ...(c.extensions || {}) }; }
  const t = await entry(c.address, tags, { extensions, bridgeInfo: c.bridgeInfo });
  if (!t.logoURI) todo.push({ address: t.address, symbol: t.symbol, name: t.name, image: (row && launchImage(row.metadataURI)) || null });
  curated.push(t);
}

// Extended: curated + every launchpad token from a known launchpad that passes the activity filter
const extended = [...curated];
const taken = new Set(curated.map((t) => t.address.toLowerCase()));
const symbols = new Map(curated.map((t) => [t.symbol.toLowerCase(), t.address]));
for (const row of [...rows].sort((x, y) => Number(x.createdBlock ?? 0) - Number(y.createdBlock ?? 0))) {
  const k = row.address.toLowerCase();
  if (taken.has(k)) continue;
  const label = `${row.symbol} ${row.address}`;
  if (row.source !== 'launchpad' || !pads.has(String(row.launchpad || '').toLowerCase())) { notes.push(`skip ${label}: not from a known launchpad`); continue; }
  if (excluded.has(k)) { notes.push(`skip ${label}: excluded in config.json`); continue; }
  if (flagged.has(k)) { notes.push(`skip ${label}: flagged by a Gully Security report`); continue; }
  if (!activeEnough(row, cfg.extended)) { notes.push(`skip ${label}: below activity filter (holders ${row.holders}, txns ${row.txns})`); continue; }
  let t;
  try { t = await entry(row.address, launchTags(row), { extensions: launchExt(row) }); }
  catch (e) { notes.push(`skip ${label}: ${e.message}`); continue; }
  if (symbols.has(t.symbol.toLowerCase())) { notes.push(`skip ${label}: symbol ${t.symbol} already listed by ${symbols.get(t.symbol.toLowerCase())}`); continue; }
  const img = launchImage(row.metadataURI);
  if (!t.logoURI) { todo.push({ address: t.address, symbol: t.symbol, name: t.name, image: img || null }); notes.push(`skip ${label}: no logo yet (python logos.py, then build again)`); continue; }
  if (img) t.extensions = { ...t.extensions, image: img };
  symbols.set(t.symbol.toLowerCase(), t.address); taken.add(k); extended.push(t);
}

// Assemble, version, validate, write
const out = {};
let failed = false;
for (const [kind, tokens] of [['default', curated], ['extended', extended]]) {
  const meta = LISTS[kind];
  const used = new Set(tokens.flatMap((t) => t.tags || []));
  const draft = {
    name: meta.name,
    timestamp: '',
    version: { major: 1, minor: 0, patch: 0 },
    logoURI: cfg.listLogoURI,
    keywords: meta.keywords,
    tags: Object.fromEntries(Object.entries(TAGS).filter(([id]) => used.has(id))),
    tokens: sortTokens(tokens),
  };
  const prev = loadList(kind);
  draft.version = nextVersion(prev, draft);
  const same = prev && vstr(prev.version) === vstr(draft.version);
  draft.timestamp = same ? prev.timestamp : new Date().toISOString();
  const errs = [...validateSchema(draft), ...checkList(draft, { chainId, logoBaseUrl: cfg.logoBaseUrl, logoExists: (rel) => existsSync(join(LOGOS_DIR, rel)) })];
  if (errs.length) { failed = true; console.error(`${meta.file}: ${errs.length} error(s)\n  ${errs.join('\n  ')}`); }
  out[kind] = draft;
  console.log(`${meta.file}: ${draft.tokens.length} tokens, version ${vstr(draft.version)}${same ? ' (unchanged)' : prev ? ` (was ${vstr(prev.version)})` : ' (new)'}`);
  for (const t of draft.tokens) console.log(`  ${t.symbol.padEnd(8)} ${t.address} ${t.decimals} [${(t.tags || []).join(',')}]`);
}
for (const n of notes) console.log(`  note: ${n}`);
writeFileSync(join(LOGOS_DIR, 'todo.json'), JSON.stringify({ chainId, tokens: todo }, null, 2) + '\n');
if (todo.length) console.log(`  ${todo.length} token(s) need a logo: logos/todo.json -> python logos.py`);
if (failed) process.exit(1);
if (!DRY) {
  mkdirSync(LISTS_DIR, { recursive: true });
  for (const [kind, list] of Object.entries(out)) writeFileSync(join(LISTS_DIR, LISTS[kind].file), JSON.stringify(list, null, 2) + '\n');
  console.log('wrote lists/');
}
