// Runs the API handlers against a real but throwaway MongoDB (mongodb-memory-server). Never touches Atlas.
//   npm test
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';

const server = await MongoMemoryServer.create();
process.env.MONGODB_URI = server.getUri(); // overrides anything from the shell: tests must never hit Atlas
process.env.MONGODB_DB = 'cc_test';
delete process.env.DNS_SERVERS;
process.env.ADMIN_TOKEN = 'test-admin-token-123456';
process.env.MAX_SCORE_PER_WAVE = '5000';
assert.match(process.env.MONGODB_URI, /^mongodb:\/\/127\.0\.0\.1:/);

const { BOARD_VERSION, INDEXES, LIMITS, OUTPUT, VALIDATORS, newPlayerDoc } = await import('../api/_schema.js');
const { mongo, saveRun } = await import('../api/_lib.js');
const submit = (await import('../api/submit.js')).default;
const top = (await import('../api/top.js')).default;
const me = (await import('../api/me.js')).default;
const del = (await import('../api/delete.js')).default;
const adminRemove = (await import('../api/admin/remove.js')).default;

let store;
before(async () => { store = await mongo(); });
after(async () => { await store.client.close(); await server.stop(); });
const reset = async () => { await store.players.deleteMany({}); await store.rate.deleteMany({}); };

async function call(handler, { method = 'GET', url = '/', body, headers = {}, ip = '1.2.3.4' } = {}) {
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const req = { method, url, body, headers: { 'content-length': raw ? String(raw.length) : '0', 'x-forwarded-for': ip, ...headers } };
  const res = { statusCode: 200, headers: {}, data: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(d) { this.data = d || ''; } };
  await handler(req, res);
  return { status: res.statusCode, headers: res.headers, json: res.data ? JSON.parse(res.data) : null };
}

const hex = (c) => c.repeat(32).slice(0, 32);
const now = () => Math.floor(Date.now() / 1000);
const run = (o = {}) => ({ player_id: hex('a1'), name: 'Sita', score: 1200, wave: 3, kills: 9, kite: 'kite0', map: 'boudha', version: '1.0.0', ts: now(), ...o });
const post = (h, body, extra) => call(h, { method: 'POST', body, ...extra });
/** Every stored player must pass the schema's validator (the collection also enforces it). */
const assertAllValid = async () => assert.equal(await store.players.countDocuments({ $nor: [VALIDATORS.players] }), 0, 'a stored document breaks the validator');

test('submit stores a run and returns rank and best', async () => {
  await reset();
  const r = await post(submit, run());
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, rank: 1, best: 1200 });
  assert.deepEqual(Object.keys(r.json), OUTPUT.submit);
  assert.equal(r.headers['access-control-allow-origin'], '*');
  const doc = await store.players.findOne({ _id: hex('a1') });
  assert.equal(doc.board, BOARD_VERSION);
  assert.equal(doc.kite, 'kite0');
  await assertAllValid();
});

test('best only goes up, name follows the latest submit, history newest first', async () => {
  await reset();
  await post(submit, run({ score: 2000 }));
  const lower = await post(submit, run({ score: 500, name: 'Sita K' }));
  assert.deepEqual(lower.json, { ok: true, rank: 1, best: 2000 });
  const t = await call(top, { url: '/api/top' });
  assert.equal(t.json[0].name, 'Sita K');
  assert.equal(t.json[0].score, 2000);
  const doc = await store.players.findOne({ _id: hex('a1') });
  assert.deepEqual(doc.history.map((h) => h.score), [500, 2000]);
  await assertAllValid();
});

test('a first run with score 0 still gets on the board', async () => {
  await reset();
  const r = await post(submit, run({ score: 0 }));
  assert.deepEqual(r.json, { ok: true, rank: 1, best: 0 });
  assert.equal((await call(top, { url: '/api/top' })).json.length, 1);
});

test('two different scores submitted at the same time keep the higher one', async () => {
  await reset();
  await Promise.all([post(submit, run({ score: 900 }), { ip: 'c1' }), post(submit, run({ score: 4000 }), { ip: 'c2' }), post(submit, run({ score: 1500 }), { ip: 'c3' })]);
  const doc = await store.players.findOne({ _id: hex('a1') });
  assert.equal(doc.best, 4000);
  assert.equal(doc.history.length, 3);
  await assertAllValid();
});

test('history is capped at 50', async () => {
  await reset();
  for (let i = 0; i < LIMITS.historyLength + 5; i++) await saveRun(store, run({ score: i }));
  const doc = await store.players.findOne({ _id: hex('a1') });
  assert.equal(doc.history.length, LIMITS.historyLength);
  assert.equal(doc.history[0].score, LIMITS.historyLength + 4, 'newest first');
  assert.equal(doc.best, LIMITS.historyLength + 4);
  await assertAllValid();
});

test('top returns ranked list with tags, limited, cached 30s', async () => {
  await reset();
  await post(submit, run({ player_id: hex('4f2a'), name: 'Ram', score: 900 }), { ip: '9.9.9.1' });
  await post(submit, run({ player_id: hex('b0b0'), name: 'Hari', score: 3000 }), { ip: '9.9.9.2' });
  await post(submit, run({ player_id: hex('c3c3'), name: 'Gita', score: 1500 }), { ip: '9.9.9.3' });
  const t = await call(top, { url: '/api/top?limit=2' });
  assert.equal(t.status, 200);
  assert.deepEqual(t.json.map((x) => [x.rank, x.name, x.tag, x.score]), [[1, 'Hari', 'B0B0', 3000], [2, 'Gita', 'C3C3', 1500]]);
  assert.deepEqual(Object.keys(t.json[0]), OUTPUT.topRow);
  assert.match(t.headers['cache-control'], /s-maxage=30/);
});

test('ties: equal scores share a rank in /me, earlier run listed first in /top', async () => {
  await reset();
  await post(submit, run({ player_id: hex('1111'), name: 'Later', score: 1000, ts: now() - 10 }), { ip: 't1' });
  await post(submit, run({ player_id: hex('2222'), name: 'Earlier', score: 1000, ts: now() - 500 }), { ip: 't2' });
  await post(submit, run({ player_id: hex('3333'), name: 'Top', score: 5000 }), { ip: 't3' });
  const t = await call(top, { url: '/api/top' });
  assert.deepEqual(t.json.map((x) => x.name), ['Top', 'Earlier', 'Later']);
  assert.equal((await call(me, { url: '/api/me?player_id=' + hex('1111') })).json.rank, 2);
  assert.equal((await call(me, { url: '/api/me?player_id=' + hex('2222') })).json.rank, 2);
});

test('me returns rank and best, nulls when unknown', async () => {
  await reset();
  await post(submit, run());
  const m = await call(me, { url: '/api/me?player_id=' + hex('a1') });
  assert.deepEqual(m.json, { ok: true, rank: 1, best: 1200 });
  assert.deepEqual(Object.keys(m.json), OUTPUT.me);
  assert.deepEqual((await call(me, { url: '/api/me?player_id=' + hex('ff') })).json, { ok: true, rank: null, best: null });
  assert.equal((await call(me, { url: '/api/me?player_id=nope' })).status, 400);
});

test('validation rejects bad input', async () => {
  await reset();
  const cases = {
    bad_player_id: { player_id: 'ABC' },
    name_length: { name: 'S' },
    name_chars: { name: '<b>hi</b>' },
    name_needs_letter: { name: '12 34' },
    name_looks_like_phone: { name: 'm 9841234567' },
    name_looks_like_email: { name: 'sita gmail' },
    score_implausible: { score: 99999, wave: 2 },
    bad_score: { score: 1.5 },
    bad_wave: { wave: 0 },
    bad_ts: { ts: now() - 31 * 24 * 3600 },
    bad_kite: { kite: 'x'.repeat(40) },
    bad_map: { map: { $gt: '' } },
    bad_version: { version: '1.0.0; drop' },
  };
  for (const [code, patch] of Object.entries(cases)) {
    const r = await post(submit, run(patch));
    assert.equal(r.status, 400, code);
    assert.equal(r.json.error, code);
    assert.ok(OUTPUT.errorCodes.includes(code), code + ' is listed in _schema.js');
  }
  assert.equal(await store.players.countDocuments(), 0);
});

test('name filter: blocks rude names, keeps innocent ones', async () => {
  await reset();
  for (const name of ['fuck you', 'F u C k', 'sh1tlord', 'MUJI', 'big ass', 'chutiya99', 'machikne', 'dick']) {
    const r = await post(submit, run({ name }), { ip: 'n-' + name });
    assert.equal(r.json.error, 'name_not_allowed', name);
  }
  let i = 0;
  for (const name of ['Classic', 'Dickson', 'Computing', 'Sussex', 'Hancock', 'Bassist']) {
    const r = await post(submit, run({ name, player_id: hex(String(++i)) }), { ip: 'ok-' + name });
    assert.equal(r.json.ok, true, name);
  }
});

test('body over 1 KB is rejected', async () => {
  await reset();
  assert.equal((await post(submit, run({ junk: 'x'.repeat(1100) }))).status, 413);
});

test('rate limit: 10 per player per hour', async () => {
  await reset();
  for (let i = 0; i < 10; i++) assert.equal((await post(submit, run({ score: i }), { ip: 'p' + i })).status, 200);
  const r = await post(submit, run(), { ip: 'p-last' });
  assert.equal(r.status, 429);
  assert.equal(r.json.error, 'rate_limited');
});

test('rate limit: 30 per IP per hour, stored without the raw IP', async () => {
  await reset();
  for (let i = 0; i < 30; i++) assert.equal((await post(submit, run({ player_id: (i + 1000).toString(16).padStart(32, '0') }), { ip: '203.0.113.7' })).status, 200);
  assert.equal((await post(submit, run({ player_id: hex('e') }), { ip: '203.0.113.7' })).status, 429);
  const ids = (await store.rate.find().toArray()).map((d) => d._id).join(' ');
  assert.ok(!ids.includes('203.0.113.7'));
  assert.equal(await store.rate.countDocuments({ $nor: [VALIDATORS.rate] }), 0);
});

test('indexes from _schema.js exist, including the TTL on rate.expireAt', async () => {
  const rateIx = await store.rate.indexes();
  const ttl = rateIx.find((i) => i.key.expireAt === 1);
  assert.equal(ttl?.expireAfterSeconds, 0);
  const playerIx = (await store.players.indexes()).map((i) => JSON.stringify(i.key));
  for (const ix of INDEXES.players) assert.ok(playerIx.includes(JSON.stringify(ix.key)), JSON.stringify(ix.key));
});

test('the database itself rejects a document that breaks the schema', async () => {
  await reset();
  const good = newPlayerDoc({ ...run(), player_id: hex('9') });
  await store.players.insertOne(good);
  await assert.rejects(store.players.insertOne({ ...good, _id: hex('8'), cheat: true }), /validation/i);
  await assert.rejects(store.players.insertOne({ ...good, _id: 'NOT-HEX' }), /validation/i);
});

test('delete removes everything for the player', async () => {
  await reset();
  await post(submit, run());
  assert.deepEqual((await post(del, { player_id: hex('a1') })).json, { ok: true });
  assert.deepEqual((await call(top, { url: '/api/top' })).json, []);
  assert.equal(await store.players.countDocuments(), 0);
  assert.equal((await post(del, { player_id: 'bad' })).status, 400);
});

test('admin remove needs the token, works by id or tag', async () => {
  await reset();
  await post(submit, run({ player_id: hex('4f2a'), name: 'Cheater' }));
  await post(submit, run({ player_id: hex('b0b0'), name: 'Fair' }), { ip: '5.5.5.5' });
  assert.equal((await post(adminRemove, { tag: '4F2A' })).status, 401);
  assert.equal((await post(adminRemove, { tag: '4F2A' }, { headers: { 'x-admin-token': 'wrong' } })).status, 401);
  const r = await post(adminRemove, { tag: '4F2A' }, { headers: { authorization: 'Bearer ' + process.env.ADMIN_TOKEN } });
  assert.deepEqual(r.json, { ok: true, removed: [hex('4f2a')] });
  assert.deepEqual((await call(top, { url: '/api/top' })).json.map((x) => x.name), ['Fair']);
});

test('OPTIONS preflight and wrong method', async () => {
  assert.equal((await call(submit, { method: 'OPTIONS' })).status, 204);
  assert.equal((await call(submit, { method: 'GET' })).status, 405);
  assert.equal((await call(top, { method: 'POST' })).status, 405);
});
