// Pure helpers shared by build.mjs, validate.mjs and the tests. No network here.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress, isAddress } from 'viem';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');
export const LISTS_DIR = join(ROOT, 'lists');
export const LOGOS_DIR = join(ROOT, 'logos');
export const CONFIG_PATH = join(ROOT, 'gully', 'config.json');
export const SCHEMA_VERSION = '1.0.0-beta.35';
export const LISTS = {
  default: { file: 'gully.tokenlist.json', name: 'Gully Chain', keywords: ['gully', 'gully chain', 'arbitrum orbit', 'l3', 'default'] },
  extended: { file: 'gully-extended.tokenlist.json', name: 'Gully Chain Extended', keywords: ['gully', 'gully chain', 'arbitrum orbit', 'l3', 'launchpad', 'extended'] },
};

// Schema limits: tag ids ^[\w]+$ (at most 10 characters), names ^[ \w]+$, descriptions ^[ \w.,:]+$. So the
// "native-wrapped" tag is id `wrapped`, name "native wrapped".
export const TAGS = {
  wrapped: { name: 'native wrapped', description: 'WETH9, the wrapped native gas token. Unwraps 1:1 to ETH on Gully Chain' },
  stablecoin: { name: 'stablecoin', description: 'Token that tracks the US dollar' },
  bridged: { name: 'bridged', description: 'Bridged to Gully Chain from Arbitrum Sepolia. The origin token is in extensions.bridgeInfo' },
  launchpad: { name: 'launchpad', description: 'Launched on DeepCore, the Gully Chain launchpad. Testnet: test token, no value' },
  graduated: { name: 'graduated', description: 'Graduated from the launchpad bonding curve to a Gully Swap pool' },
};

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const loadConfig = () => loadJson(CONFIG_PATH);
export const loadSchema = () => loadJson(join(HERE, 'node_modules', '@uniswap', 'token-lists', 'src', 'tokenlist.schema.json'));
export const loadList = (kind) => { const p = join(LISTS_DIR, LISTS[kind].file); return existsSync(p) ? loadJson(p) : null; };

export const isChecksummed = (a) => typeof a === 'string' && isAddress(a, { strict: false }) && getAddress(a) === a;
export const vstr = (v) => `${v.major}.${v.minor}.${v.patch}`;

/** Logo file name for a token: logos/<chainId>/<checksummed address>.<ext>. */
export const logoPath = (chainId, address, ext) => join(LOGOS_DIR, String(chainId), `${getAddress(address)}.${ext}`);
export function findLogo(chainId, address) {
  for (const ext of ['svg', 'png']) if (existsSync(logoPath(chainId, address, ext))) return ext;
  return null;
}

/**
 * Version bump the token-lists way (as @uniswap/token-lists minVersionBump): a removed token = major, an added token =
 * minor, any other change (metadata, tags, logo, list name or tags) = patch, nothing changed = same version.
 * Tokens are keyed by chainId + lowercased address.
 */
export function nextVersion(prev, next) {
  if (!prev) return { major: 1, minor: 0, patch: 0 };
  const key = (t) => `${t.chainId}:${t.address.toLowerCase()}`;
  const a = new Map(prev.tokens.map((t) => [key(t), canon(t)]));
  const b = new Map(next.tokens.map((t) => [key(t), canon(t)]));
  const v = prev.version;
  if ([...a.keys()].some((k) => !b.has(k))) return { major: v.major + 1, minor: 0, patch: 0 };
  if ([...b.keys()].some((k) => !a.has(k))) return { major: v.major, minor: v.minor + 1, patch: 0 };
  const meta = (l) => canon({ name: l.name, logoURI: l.logoURI, keywords: l.keywords, tags: l.tags });
  if ([...b.keys()].some((k) => a.get(k) !== b.get(k)) || meta(prev) !== meta(next)) return { ...v, patch: v.patch + 1 };
  return { ...v };
}

/** Stable JSON (sorted keys) so key order never counts as a change. */
export function canon(x) {
  if (Array.isArray(x)) return `[${x.map(canon).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}

/**
 * Checks the schema cannot express: duplicate addresses, duplicate symbols (one per list, case-insensitive), checksums,
 * one chain id, tags defined, bridgeInfo addresses checksummed, logo file present for our own logo URLs.
 * Returns a list of error strings (empty = fine).
 */
export function checkList(list, { chainId, logoBaseUrl, logoExists } = {}) {
  const errors = [];
  const addrs = new Set(); const syms = new Map();
  for (const t of list.tokens || []) {
    const id = `${t.symbol} ${t.address}`;
    if (!isChecksummed(t.address)) errors.push(`${id}: address is not EIP-55 checksummed`);
    if (chainId && t.chainId !== chainId) errors.push(`${id}: chainId ${t.chainId}, expected ${chainId}`);
    const k = `${t.chainId}:${String(t.address).toLowerCase()}`;
    if (addrs.has(k)) errors.push(`${id}: duplicate address`);
    addrs.add(k);
    const s = `${t.chainId}:${String(t.symbol).toLowerCase()}`;
    if (syms.has(s)) errors.push(`${id}: duplicate symbol (also ${syms.get(s)})`);
    else syms.set(s, t.address);
    if (!Number.isInteger(t.decimals) || t.decimals < 0 || t.decimals > 255) errors.push(`${id}: bad decimals ${t.decimals}`);
    for (const tag of t.tags || []) if (!list.tags?.[tag]) errors.push(`${id}: tag "${tag}" is not defined in list.tags`);
    const bi = t.extensions?.bridgeInfo;
    if (bi) for (const [cid, v] of Object.entries(bi)) if (!isChecksummed(v?.tokenAddress)) errors.push(`${id}: bridgeInfo[${cid}].tokenAddress not checksummed`);
    if (!t.logoURI) errors.push(`${id}: no logoURI`);
    else if (logoBaseUrl && t.logoURI.startsWith(logoBaseUrl + '/') && logoExists) {
      const rel = t.logoURI.slice(logoBaseUrl.length + 1);
      if (!logoExists(rel)) errors.push(`${id}: logo file logos/${rel} missing`);
      const m = /^(\d+)\/(0x[0-9a-fA-F]{40})\.(png|svg)$/.exec(rel);
      if (!m || Number(m[1]) !== t.chainId || m[2] !== t.address) errors.push(`${id}: logoURI must be ${logoBaseUrl}/${t.chainId}/${t.address}.png|svg`);
    }
  }
  return errors;
}

/** Token entry order: by symbol, then address (stable output, readable diffs). */
export const sortTokens = (tokens) => [...tokens].sort((x, y) => x.symbol.localeCompare(y.symbol, 'en') || x.address.localeCompare(y.address));

/** image URL from a launch's metadataURI (data:application/json[;base64], or plain JSON), https:// or ipfs:// only. */
export function launchImage(uri) {
  try {
    const m = /^data:application\/json(;base64)?,([\s\S]*)$/.exec(uri || '');
    if (!m) return undefined;
    const json = JSON.parse(m[1] ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2]));
    const img = json?.image;
    if (typeof img === 'string' && img.length <= 500 && /^(https:\/\/|ipfs:\/\/)[^\s"<>]+$/.test(img)) return img;
  } catch { /* bad metadata = no image */ }
  return undefined;
}

/** Extended-list admission for a launchpad token from the indexer row. */
export function activeEnough(row, { minHolders, minTxns }) {
  if (row.graduated || (row.pools && row.pools.length > 0 && row.complete)) return true;
  return (row.holders ?? 0) >= minHolders && (row.txns ?? 0) >= minTxns;
}

/** Addresses flagged by published Gully Security reports (critical or high findings) on this chain. */
export function flaggedBySecurity(reports, chainId) {
  const out = new Set();
  for (const r of reports || []) {
    const c = r.counts || {};
    if (!((c.critical ?? 0) > 0 || (c.high ?? 0) > 0)) continue;
    const text = JSON.stringify(r.input ?? '');
    if (r.input && typeof r.input === 'object' && r.input.chainId && Number(r.input.chainId) !== chainId) continue;
    for (const m of text.matchAll(/0x[0-9a-fA-F]{40}/g)) out.add(m[0].toLowerCase());
  }
  return out;
}
