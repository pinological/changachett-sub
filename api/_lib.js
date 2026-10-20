// Shared helpers for the leaderboard functions. Field names, limits and regexes come from _schema.js.
//
// Honest limits: there is no login, so a determined player can fake a score by calling the API
// directly. Plausibility limits (score per wave, recent timestamp), rate limits and the admin
// remove tool are the only defences, and that is an accepted trade-off for a free offline game.
//
// Privacy: no cookies, no analytics, and nothing personal is logged. The IP is used only as a
// hashed, hour-long rate-limit key that expires on its own. Errors never reach the client or the
// logs with details (they could contain the connection string): clients get "server_error" only.

import { createHash, timingSafeEqual } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { BEST_RUN_FIELDS, BOARD_VERSION, COLLECTIONS, INDEXES, LIMITS, PATTERNS, VALIDATORS, newRunDoc } from './_schema.js';
import { SUBSTRING, TOKEN } from './_blocklist.js';

export const BOARD = BOARD_VERSION;
const ON_BOARD = { board: BOARD, best: { $gte: 0 } }; // best -1 = registered but not on the board

// ---------- MongoDB ----------
// Kept on globalThis so warm Vercel invocations reuse one connection pool.
export function mongo() {
  globalThis.__ccMongo ??= (async () => {
    if (process.env.DNS_SERVERS) (await import('node:dns')).setServers(process.env.DNS_SERVERS.split(',')); // local Windows fix, see README
    const client = await new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 }).connect();
    const db = client.db(process.env.MONGODB_DB || 'changachett');
    await ensureDb(db);
    return { client, db, players: db.collection(COLLECTIONS.players), rate: db.collection(COLLECTIONS.rate) };
  })().catch((e) => { globalThis.__ccMongo = null; throw e; });
  return globalThis.__ccMongo;
}

/**
 * Creates the collections with their validators and indexes (idempotent, once per cold start).
 * Applying a validator to an existing collection needs the dbAdmin role; with a read/write-only
 * app user that step is skipped quietly (run `npm run setup-db` once with an admin user instead).
 */
export async function ensureDb(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const [key, name] of Object.entries(COLLECTIONS)) {
    const opts = { validator: VALIDATORS[key], validationLevel: 'strict', validationAction: 'error' };
    try {
      if (!existing.has(name)) await db.createCollection(name, opts);
      else await db.command({ collMod: name, ...opts });
    } catch (e) {
      // 13 Unauthorized, 8000 AtlasError "not allowed", 48 already exists (race): skip, the app still works
      const notAllowed = e?.code === 13 || (e?.code === 8000 && /not allowed/i.test(e?.message));
      if (!notAllowed && e?.code !== 48) throw e;
    }
    for (const ix of INDEXES[key]) await db.collection(name).createIndex(ix.key, ix.options);
  }
}

// ---------- HTTP ----------
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function send(res, status, body, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

export const fail = (res, status, error) => send(res, status, { ok: false, error });

/** Handles CORS + preflight + method check. Returns false if the request was already answered. */
export function begin(req, res, method) {
  cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return false; }
  if (req.method !== method) { fail(res, 405, 'method_not_allowed'); return false; }
  return true;
}

/** Parses a small JSON body. Returns null (and answers) when it is too big or not JSON. */
export function readBody(req, res) {
  const len = Number(req.headers['content-length'] || 0);
  if (len > LIMITS.bodyBytes) { fail(res, 413, 'body_too_large'); return null; }
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { body = null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) { fail(res, 400, 'bad_json'); return null; }
  if (JSON.stringify(body).length > LIMITS.bodyBytes) { fail(res, 413, 'body_too_large'); return null; }
  return body;
}

export function clientIpHash(req) {
  const raw = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return createHash('sha256').update('cc-rl:' + raw).digest('hex').slice(0, 20);
}

/** Fixed one-hour window counter in the `rate` collection. Returns true while under the limit. */
export async function allow({ rate }, kind, who, max) {
  const hour = Math.floor(Date.now() / 3600_000);
  const doc = await rate.findOneAndUpdate(
    { _id: `${kind}:${who}:${hour}` },
    { $inc: { n: 1 }, $setOnInsert: { expireAt: new Date((hour + 1) * 3600_000) } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.n <= max;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------- validation ----------
export const isPlayerId = (v) => typeof v === 'string' && PATTERNS.playerId.test(v);
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', $: 's', '@': 'a', '!': 'i' };
const deLeet = (s) => s.toLowerCase().replace(/[01345789$@!]/g, (c) => LEET[c] ?? c);

/** Returns { name } (cleaned) or { error } with a "name_*" code. */
export function checkName(input) {
  if (typeof input !== 'string') return { error: 'name_missing' };
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) return { error: 'name_length' };
  if (!PATTERNS.name.test(name)) return { error: 'name_chars' };
  if (!PATTERNS.nameLetter.test(name)) return { error: 'name_needs_letter' };
  if ((name.match(/\d/g) || []).length >= 7) return { error: 'name_looks_like_phone' };
  if (/(gmail|yahoo|hotmail|outlook|icloud)/i.test(name)) return { error: 'name_looks_like_email' };

  const tokens = deLeet(name).split(/[ _-]+/).filter(Boolean);
  const joined = tokens.join('');
  // Also catch letter-spaced words like "f u c k" by checking the joined string.
  if (SUBSTRING.some((w) => joined.includes(w))) return { error: 'name_not_allowed' };
  if (tokens.some((t) => TOKEN.includes(t)) || TOKEN.includes(joined)) return { error: 'name_not_allowed' };
  return { name };
}

const shortText = (v) => (v === undefined || v === null ? '' : typeof v === 'number' ? String(v) : v);

/** Validates a submit body. Returns { run } or { error }. */
export function checkRun(b) {
  if (!isPlayerId(b.player_id)) return { error: 'bad_player_id' };
  const n = checkName(b.name);
  if (n.error) return n;
  if (!isInt(b.wave, 1, LIMITS.maxWave)) return { error: 'bad_wave' };
  if (!isInt(b.kills, 0, LIMITS.maxKills)) return { error: 'bad_kills' };
  if (!isInt(b.score, 0, LIMITS.maxScoreAbsolute)) return { error: 'bad_score' };
  if (b.score > b.wave * LIMITS.maxScorePerWave) return { error: 'score_implausible' };

  let ts = Number(b.ts);
  if (!Number.isFinite(ts)) return { error: 'bad_ts' };
  if (ts > 1e12) ts = Math.floor(ts / 1000); // accept milliseconds too
  ts = Math.floor(ts);
  const now = Math.floor(Date.now() / 1000);
  if (ts < now - LIMITS.tsMaxAgeSec || ts > now + LIMITS.tsMaxFutureSec) return { error: 'bad_ts' };

  const kite = shortText(b.kite), map = shortText(b.map), version = shortText(b.version);
  if (typeof kite !== 'string' || !PATTERNS.text.test(kite)) return { error: 'bad_kite' };
  if (typeof map !== 'string' || !PATTERNS.text.test(map)) return { error: 'bad_map' };
  if (typeof version !== 'string' || !PATTERNS.version.test(version)) return { error: 'bad_version' };

  return { run: { player_id: b.player_id, name: n.name, score: b.score, wave: b.wave, kills: b.kills, kite, map, version, ts } };
}

// ---------- data ----------
/**
 * Stores a validated run. Best only goes up, the name follows the latest submit, history keeps the
 * newest LIMITS.historyLength runs (newest first). Returns the player's best afterwards.
 */
export async function saveRun({ players }, run) {
  const id = run.player_id;
  // A player last seen on an older board starts again on this one.
  await players.updateOne({ _id: id, board: { $ne: BOARD } }, { $set: { best: LIMITS.noScore } });
  // Step 1: create or touch the player; a new player starts with best -1 so step 2 always matches.
  await players.updateOne(
    { _id: id },
    {
      $set: { name: run.name, board: BOARD, updatedAt: new Date() },
      $push: { history: { $each: [newRunDoc(run)], $position: 0, $slice: LIMITS.historyLength } },
      $setOnInsert: { best: LIMITS.noScore },
    },
    { upsert: true },
  );
  // Step 2: atomic "only if higher", so two submits racing each other keep the higher score.
  await players.updateOne(
    { _id: id, best: { $lt: run.score } },
    { $set: { best: run.score, ...Object.fromEntries(BEST_RUN_FIELDS.map((f) => [f, run[f]])) } },
  );
  const doc = await players.findOne({ _id: id }, { projection: { best: 1 } });
  return doc.best;
}

/** Players on the current board, best first; equal scores: earlier run first. */
export function topDocs({ players }, limit) {
  return players.find(ON_BOARD, { projection: { name: 1, best: 1, wave: 1, ts: 1 } }).sort({ best: -1, ts: 1 }).limit(limit).toArray();
}

/** The player's best on the current board, or null. */
export async function bestOf({ players }, id) {
  const doc = await players.findOne({ _id: id, ...ON_BOARD }, { projection: { best: 1 } });
  return doc ? doc.best : null;
}

/** 1-based rank of a best score on the current board (ties share a rank), or null. */
export async function rankOf({ players }, best) {
  if (best === null || best === undefined || best < 0) return null;
  return (await players.countDocuments({ ...ON_BOARD, best: { $gt: best } })) + 1;
}

/** Removes everything stored for one player (board entry, profile and history live in one document). */
export async function removePlayer({ players }, id) {
  await players.deleteOne({ _id: id });
}

/** Player ids starting with a 4-character tag (max 20). */
export function findByTag({ players }, tag) {
  return players.find({ _id: { $regex: '^' + tag.toLowerCase() } }, { projection: { name: 1 } }).limit(20).toArray();
}
