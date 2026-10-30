import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion, checkList, canon, launchImage, activeEnough, flaggedBySecurity, isChecksummed, TAGS, gatewayUrl, metadataImage, gullyCoreLogo, gullyCoreSkipReason, isLegacyRow } from '../lib.mjs';
import { validateSchema } from '../schema.mjs';

const A = '0x26aCCCb2e98ca9e067E58668Aa3B101beF432754';
const B = '0x65Ba03c6FA90Ed549f465D4c8f2e784D6eEB7E76';
const C = '0xDBE84bE6496Fb3d07F601548555ec7Acc4CeBa8F';
const tok = (address, symbol, extra = {}) => ({ chainId: 485590, address, name: symbol, symbol, decimals: 18, logoURI: `https://gullychain.xyz/tokens/logos/485590/${address}.png`, ...extra });
const list = (tokens, version = { major: 1, minor: 0, patch: 0 }) => ({ name: 'Gully Chain', timestamp: '2026-10-27T00:00:00.000Z', version, logoURI: 'https://gullychain.xyz/assets/apple-touch-icon.png', keywords: ['gully'], tags: TAGS, tokens });

test('version: first build is 1.0.0', () => assert.deepEqual(nextVersion(null, list([tok(A, 'WETH')])), { major: 1, minor: 0, patch: 0 }));
test('version: unchanged list keeps the version', () => {
  const p = list([tok(A, 'WETH'), tok(B, 'USDC')], { major: 2, minor: 3, patch: 4 });
  assert.deepEqual(nextVersion(p, list([tok(B, 'USDC'), tok(A, 'WETH')])), { major: 2, minor: 3, patch: 4 });
});
test('version: removal is major', () => {
  const p = list([tok(A, 'WETH'), tok(B, 'USDC')], { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(nextVersion(p, list([tok(A, 'WETH'), tok(C, 'USDT')])), { major: 2, minor: 0, patch: 0 });
});
test('version: addition is minor', () => {
  const p = list([tok(A, 'WETH')], { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(nextVersion(p, list([tok(A, 'WETH'), tok(B, 'USDC')])), { major: 1, minor: 3, patch: 0 });
});
test('version: metadata change is patch (token or list)', () => {
  const p = list([tok(A, 'WETH')], { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(nextVersion(p, list([tok(A, 'WETH', { name: 'Wrapped Ether' })])), { major: 1, minor: 2, patch: 4 });
  assert.deepEqual(nextVersion(p, { ...list([tok(A, 'WETH')]), name: 'Other' }), { major: 1, minor: 2, patch: 4 });
});
test('version: address case does not count as a removal', () => {
  const p = list([{ ...tok(A, 'WETH'), address: A.toLowerCase() }], { major: 1, minor: 0, patch: 0 });
  const v = nextVersion(p, list([tok(A, 'WETH')]));
  assert.equal(v.major, 1); assert.equal(v.minor, 0);
});
test('canon ignores key order', () => assert.equal(canon({ b: 1, a: [1, { y: 2, x: 1 }] }), canon({ a: [1, { x: 1, y: 2 }], b: 1 })));

test('checkList: clean list passes', () => assert.deepEqual(checkList(list([tok(A, 'WETH'), tok(B, 'USDC')]), { chainId: 485590 }), []));
test('checkList: duplicate address', () => {
  const e = checkList(list([tok(A, 'WETH'), tok(A, 'WETH2')]), { chainId: 485590 });
  assert.ok(e.some((x) => x.includes('duplicate address')));
});
test('checkList: duplicate symbol (case-insensitive)', () => {
  const e = checkList(list([tok(A, 'WETH'), tok(B, 'weth')]), { chainId: 485590 });
  assert.ok(e.some((x) => x.includes('duplicate symbol')));
});
test('checkList: bad checksum', () => {
  const e = checkList(list([tok(A.toLowerCase(), 'WETH')]), { chainId: 485590 });
  assert.ok(e.some((x) => x.includes('checksummed')));
});
test('checkList: wrong chain, bad decimals, undefined tag, missing logo', () => {
  const e = checkList(list([tok(A, 'WETH', { chainId: 1, decimals: 300, tags: ['nope'], logoURI: undefined })]), { chainId: 485590 });
  for (const s of ['chainId 1', 'bad decimals', 'tag "nope"', 'no logoURI']) assert.ok(e.some((x) => x.includes(s)), s);
});
test('checkList: logo file must exist and be named after the address', () => {
  const base = 'https://gullychain.xyz/tokens/logos';
  assert.ok(checkList(list([tok(A, 'WETH')]), { logoBaseUrl: base, logoExists: () => false }).some((x) => x.includes('missing')));
  const wrong = tok(A, 'WETH', { logoURI: `${base}/485590/${B}.png` });
  assert.ok(checkList(list([wrong]), { logoBaseUrl: base, logoExists: () => true }).some((x) => x.includes('logoURI must be')));
});
test('checkList: bridgeInfo address must be checksummed', () => {
  const t = tok(B, 'USDC', { extensions: { bridgeInfo: { 421614: { tokenAddress: A.toLowerCase() } } } });
  assert.ok(checkList(list([t])).some((x) => x.includes('bridgeInfo')));
});

test('schema: valid list passes, bad tag id and bad address fail', () => {
  assert.deepEqual(validateSchema(list([tok(A, 'WETH', { tags: ['wrapped'] })])), []);
  assert.ok(validateSchema({ ...list([tok(A, 'WETH')]), tags: { 'native-wrapped': { name: 'x', description: 'y' } } }).length > 0);
  assert.ok(validateSchema(list([tok('0x123', 'WETH')])).length > 0);
});

test('launchImage: base64 and plain data URIs, https/ipfs only', () => {
  const b64 = 'data:application/json;base64,' + Buffer.from(JSON.stringify({ image: 'https://x.y/a.png' })).toString('base64');
  assert.equal(launchImage(b64), 'https://x.y/a.png');
  assert.equal(launchImage('data:application/json,' + encodeURIComponent(JSON.stringify({ image: 'ipfs://Qm1' }))), 'ipfs://Qm1');
  assert.equal(launchImage('data:application/json,' + encodeURIComponent(JSON.stringify({ image: 'javascript:alert(1)' }))), undefined);
  assert.equal(launchImage('not json'), undefined);
});
test('activity filter', () => {
  const f = { minHolders: 2, minTxns: 3 };
  assert.equal(activeEnough({ holders: 3, txns: 2 }, f), false);
  assert.equal(activeEnough({ holders: 2, txns: 3 }, f), true);
  assert.equal(activeEnough({ holders: 0, txns: 0, graduated: true }, f), true);
});
test('security flags: only critical/high reports on this chain', () => {
  const r = [
    { input: { chainId: 485590, address: A }, counts: { critical: 1 } },
    { input: { chainId: 485590, address: B }, counts: { medium: 4 } },
    { input: { chainId: 1, address: C }, counts: { high: 1 } },
  ];
  const s = flaggedBySecurity(r, 485590);
  assert.ok(s.has(A.toLowerCase())); assert.ok(!s.has(B.toLowerCase())); assert.ok(!s.has(C.toLowerCase()));
});
test('isChecksummed', () => { assert.ok(isChecksummed(A)); assert.ok(!isChecksummed(A.toLowerCase())); assert.ok(!isChecksummed('0x12')); });

// ---------------------------------------------------------------- Gully Core
test('Gully Core tags are schema-valid and described', () => {
  assert.equal(TAGS.gullycore.description, 'Launched on Gully Core');
  assert.equal(TAGS.legacy.name, 'legacy launchpad');
  const icon = 'https://ipfs.gullylabs.xyz/ipfs/bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
  const l = list([tok(A, 'WETH', { tags: ['wrapped'] }), tok(B, 'FROG', { tags: ['gullycore'], logoURI: icon, extensions: { source: 'gully-core', launchpad: '0xd46543Fcb42878868eBA0C62ea1F7801a357B12D' } }), tok(C, 'MOSS', { tags: ['launchpad', 'legacy'] })]);
  assert.deepEqual(validateSchema(l), []);
  assert.deepEqual(checkList(l, { chainId: 485590 }), []);
  // the hyphenated ids from the spec would not validate
  assert.ok(validateSchema({ ...l, tags: { ...l.tags, 'gully-core': TAGS.gullycore } }).length > 0);
});
test('Gully Core: adding a launch is a minor bump, retagging legacy is a patch', () => {
  const p = list([tok(A, 'WETH'), tok(C, 'MOSS', { tags: ['launchpad'] })], { major: 2, minor: 0, patch: 0 });
  assert.deepEqual(nextVersion(p, list([tok(A, 'WETH'), tok(C, 'MOSS', { tags: ['launchpad', 'legacy'] })])), { major: 2, minor: 0, patch: 1 });
  assert.deepEqual(nextVersion(p, list([tok(A, 'WETH'), tok(C, 'MOSS', { tags: ['launchpad'] }), tok(B, 'FROG', { tags: ['gullycore'] })])), { major: 2, minor: 1, patch: 0 });
});
test('gatewayUrl / metadataImage: ipfs to the Gully gateway, https kept, others refused', () => {
  assert.equal(gatewayUrl('ipfs://bafyicon'), 'https://ipfs.gullylabs.xyz/ipfs/bafyicon');
  assert.equal(gatewayUrl('ipfs://ipfs/bafyicon/a.png'), 'https://ipfs.gullylabs.xyz/ipfs/bafyicon/a.png');
  assert.equal(gatewayUrl('https://x.y/a.png'), 'https://x.y/a.png');
  assert.equal(gatewayUrl('http://x.y/a.png'), null);
  assert.equal(gatewayUrl('javascript:alert(1)'), null);
  assert.equal(gatewayUrl('ipfs://'), null);
  assert.equal(metadataImage({ image: 'ipfs://bafyimg' }), 'https://ipfs.gullylabs.xyz/ipfs/bafyimg');
  assert.equal(metadataImage({ name: 'x' }), null);
});
test('gullyCoreLogo: fetches the ipfs metadata JSON and maps its image', async () => {
  const seen = [];
  const getJson = async (u) => { seen.push(u); return { name: 'Frog', image: 'ipfs://bafyicon' }; };
  assert.equal(await gullyCoreLogo('ipfs://bafymeta', getJson), 'https://ipfs.gullylabs.xyz/ipfs/bafyicon');
  assert.deepEqual(seen, ['https://ipfs.gullylabs.xyz/ipfs/bafymeta']);
  const inline = 'data:application/json;base64,' + Buffer.from(JSON.stringify({ image: 'ipfs://bafyinline' })).toString('base64');
  assert.equal(await gullyCoreLogo(inline, getJson), 'https://ipfs.gullylabs.xyz/ipfs/bafyinline');
  assert.equal(await gullyCoreLogo('ipfs://bafymeta', async () => { throw new Error('504'); }), null);
  assert.equal(await gullyCoreLogo('', getJson), null);
});
test('gullyCoreSkipReason: launch, lock, icon, exclusions, activity', () => {
  const f = { minHolders: 2, minTxns: 3 };
  const ok = { launch: { createdAt: 1 }, locked: true, logo: 'https://ipfs.gullylabs.xyz/ipfs/x', row: null, excluded: false, flagged: false, filter: f };
  assert.equal(gullyCoreSkipReason(ok), null);
  assert.match(gullyCoreSkipReason({ ...ok, launch: { createdAt: 0 } }), /not a Gully Core launch/);
  assert.match(gullyCoreSkipReason({ ...ok, locked: false }), /lock not verified/);
  assert.match(gullyCoreSkipReason({ ...ok, logo: null }), /no ipfs icon/);
  assert.match(gullyCoreSkipReason({ ...ok, excluded: true }), /excluded/);
  assert.match(gullyCoreSkipReason({ ...ok, flagged: true }), /Gully Security/);
  assert.match(gullyCoreSkipReason({ ...ok, row: { holders: 1, txns: 1 } }), /activity/);
  assert.equal(gullyCoreSkipReason({ ...ok, row: { holders: 5, txns: 9 } }), null);
});
test('isLegacyRow', () => {
  assert.ok(isLegacyRow({ source: 'launchpad' })); assert.ok(isLegacyRow({ source: 'legacy-launchpad' }));
  assert.ok(!isLegacyRow({ source: 'gully-core' })); assert.ok(!isLegacyRow({ source: 'pool' }));
});
