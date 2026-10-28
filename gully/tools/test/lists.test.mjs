// The committed lists themselves: schema, checks and logos (offline; CI runs validate.mjs --onchain separately).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LISTS, LOGOS_DIR, loadList, loadConfig, checkList } from '../lib.mjs';
import { validateSchema } from '../schema.mjs';

const cfg = loadConfig();
for (const kind of Object.keys(LISTS)) {
  test(`${LISTS[kind].file} is valid`, () => {
    const l = loadList(kind);
    assert.ok(l, 'list exists');
    assert.deepEqual(validateSchema(l), []);
    assert.deepEqual(checkList(l, { chainId: cfg.chainId, logoBaseUrl: cfg.logoBaseUrl, logoExists: (rel) => existsSync(join(LOGOS_DIR, rel)) }), []);
  });
}
test('default list is contained in the extended list', () => {
  const d = loadList('default'); const e = loadList('extended');
  const ex = new Set(e.tokens.map((t) => t.address));
  for (const t of d.tokens) assert.ok(ex.has(t.address), `${t.symbol} missing from extended`);
});
test('excluded addresses are not listed', () => {
  const ex = new Set((cfg.excluded || []).map((x) => x.address.toLowerCase()));
  for (const kind of Object.keys(LISTS)) for (const t of loadList(kind).tokens) assert.ok(!ex.has(t.address.toLowerCase()), t.address);
});
test('exactly one WETH, and it is WETH9', () => {
  const w = loadList('default').tokens.filter((t) => t.symbol === 'WETH');
  assert.equal(w.length, 1);
  assert.equal(w[0].address, '0x26aCCCb2e98ca9e067E58668Aa3B101beF432754');
});
