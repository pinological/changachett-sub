# MONGODB.md: switch the leaderboard API from Upstash Redis to MongoDB Atlas

Instructions for the coding session that owns `D:\project\changachett-web`. Read `README.md` and `CONTEXT.md` first.

## Goal
Replace Upstash Redis in `api/` with **MongoDB Atlas** (free M0 cluster, already created: cluster `changachettdb`). The public API shapes in `README.md` ("API (shapes are fixed; the game depends on them)") must NOT change: the Godot game already calls `/api/submit`, `/api/top`, `/api/me`, `/api/delete`. Only the storage layer changes.

## SECRET HANDLING (important)
- The connection string is given to you **out of band as the environment variable `MONGODB_URI`**. Never write the password into any file in this repo (code, README, .env.example, tests, logs, commit messages).
- Local dev: put it in `.env.local` (already git-ignored; add `.env*.local` and `.env` to `.gitignore` if missing). Vercel: Project > Settings > Environment Variables > `MONGODB_URI` (Production, Preview, Development).
- Add `.env.example` with `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/changachett?retryWrites=true&w=majority` and `MONGODB_DB=changachett` (placeholders only).
- Use `appName`-free, `/changachett` database name in the URI path, or set `MONGODB_DB` and call `client.db(process.env.MONGODB_DB || 'changachett')`.
- Never log the URI, a request body with a player id plus IP, or raw errors that contain the URI. Return only `{ ok:false, error:"server_error" }` to clients.

## What Peter must do in Atlas (the password was pasted into a chat, so treat it as exposed)
1. Database Access > **Add New Database User** for the app only: name e.g. `changachett_app`, a fresh long random password, **Built-in role: Read and write to a specific database** > `changachett` (not "Atlas admin"). Put THIS user in `MONGODB_URI`.
2. Delete or change the password of the test user `petertest` once the new user works.
3. Network Access: `0.0.0.0/0` is required on Vercel (its server IPs change), so the password is the only gate. That is why step 1 matters. Keep the list as is (the old single-IP rows can stay or go).
4. (Optional) Atlas > Alerts: email on unusual connections.

## Driver and connection (serverless-safe)
- `npm i mongodb` (official driver). Keep the connection in a module-level cached promise so warm invocations reuse it:
  ```js
  import { MongoClient } from 'mongodb';
  let clientP;
  export function mongo() {
    clientP ??= new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 }).connect();
    return clientP.then((c) => c.db(process.env.MONGODB_DB || 'changachett'));
  }
  ```
- Replace the `redis()` helper in `api/_lib.js` with this; keep the other helpers (validation, `checkName`, `checkRun`, `tagOf`, `clientIpHash`) unchanged.
- Create indexes once, lazily on first use (idempotent `createIndex`), see below.

## Schema: ONE source of truth, used everywhere
Create **`api/_schema.js`** (and nothing else may define field names, types or limits). It exports the field list, the limits, the MongoDB `$jsonSchema` validators, a `newPlayerDoc()` / `newRunDoc()` builder and the index list. Everything imports from it:
- `api/_lib.js` (`checkRun`, `checkName`) takes the limits and regexes from it.
- Every endpoint reads and writes only fields listed in it.
- `ensureDb()` (run once per cold start) creates the collections with the validators and the indexes from it.
- Tests build their documents with `newPlayerDoc()` and check them against the same validator.
- Any script (seed, admin, migration) imports it too. The Godot game sends only the request fields listed under "Run" below, so the game, API and database always agree.

### Run (request body of `POST /api/submit`, and an entry in `players.history`)
| Field | Type | Rule |
|---|---|---|
| `player_id` | string | `^[0-9a-f]{32}$` (request only; stored as `players._id`) |
| `name` | string | 2-14 chars, `[A-Za-z0-9 _-]`, at least one letter, not blocklisted, not phone/email-like (request only; stored on the player) |
| `score` | int | 0 to `maxScoreAbsolute`, and `<= wave * MAX_SCORE_PER_WAVE` |
| `wave` | int | 1 to 999 |
| `kills` | int | 0 to 100000 |
| `kite` | string | `^[A-Za-z0-9_ -]{0,24}$` (the game sends `kite0`, `kite1`, ...) |
| `map` | string | `^[A-Za-z0-9_ -]{0,24}$` (`valley`, `boudha`, `dharahara`, `basantapur`, `swayambhu`) |
| `version` | string | `^[0-9A-Za-z.+-]{0,16}$` (the game sends `1.0.0`) |
| `ts` | int | Unix seconds, within the last 30 days, at most 10 minutes in the future (ms also accepted and converted) |

### `players` collection validator (`$jsonSchema`, `validationLevel: "strict"`, `validationAction: "error"`)
```js
{
  bsonType: 'object',
  required: ['_id', 'name', 'board', 'best', 'updatedAt'],
  additionalProperties: false,
  properties: {
    _id:       { bsonType: 'string', pattern: '^[0-9a-f]{32}$' },
    name:      { bsonType: 'string', minLength: 2, maxLength: 14 },
    board:     { bsonType: 'string', maxLength: 16 },               // BOARD_VERSION, e.g. "v1"
    best:      { bsonType: ['int', 'long', 'double'], minimum: -1 }, // -1 = registered but nothing on the board yet
    wave:      { bsonType: ['int', 'long', 'double'], minimum: 0 },
    kills:     { bsonType: ['int', 'long', 'double'], minimum: 0 },
    kite:      { bsonType: 'string', maxLength: 24 },
    map:       { bsonType: 'string', maxLength: 24 },
    version:   { bsonType: 'string', maxLength: 16 },
    ts:        { bsonType: ['int', 'long', 'double'] },
    updatedAt: { bsonType: 'date' },
    history: {
      bsonType: 'array', maxItems: 50,
      items: {
        bsonType: 'object', required: ['score', 'wave', 'kills', 'ts'], additionalProperties: false,
        properties: {
          score: { bsonType: ['int', 'long', 'double'], minimum: 0 }, wave: { bsonType: ['int', 'long', 'double'], minimum: 1 },
          kills: { bsonType: ['int', 'long', 'double'], minimum: 0 }, kite: { bsonType: 'string', maxLength: 24 },
          map: { bsonType: 'string', maxLength: 24 }, version: { bsonType: 'string', maxLength: 16 },
          ts: { bsonType: ['int', 'long', 'double'] },
        },
      },
    },
  },
}
```
(No test-only fields in production data. If a one-off test row is needed, use the separate test database `changachett_test`.)

### `rate` collection validator
```js
{ bsonType: 'object', required: ['_id', 'n', 'expireAt'], additionalProperties: false,
  properties: { _id: { bsonType: 'string', maxLength: 120 }, n: { bsonType: ['int', 'long'], minimum: 1 }, expireAt: { bsonType: 'date' } } }
```

### Indexes (from `_schema.js`)
- `players`: `{ board: 1, best: -1, ts: 1 }` (top list, rank), `{ updatedAt: 1 }`.
- `rate`: `{ expireAt: 1 }` with `expireAfterSeconds: 0`.
- Create idempotently with `createIndex`; apply validators with `createCollection(..., { validator })` or `collMod` if the collection already exists.

### Public output shapes (also defined in `_schema.js` so docs, tests and the game stay in step)
- `top` row: `{ rank:int, name:string, tag:string(4, upper hex), score:int, wave:int, ts:int }`.
- `submit` result: `{ ok:true, rank:int|null, best:int }`; `me` result: `{ ok:true, rank:int|null, best:int|null }`; errors: `{ ok:false, error:string }` with codes `bad_player_id, name_*, bad_wave, bad_kills, bad_score, score_implausible, bad_ts, bad_kite, bad_map, bad_version, rate_limited, server_error`.
- Any change to these shapes needs the Godot game (`kite/core/online.gd`, `kite/menu/leaderboard_panel.gd`) updated in the same release, so do not rename fields.

## Data model
**`players`** (one doc per player, `_id` = the 32-hex `player_id`; must satisfy the validator above):
```
{ _id, name, best, wave, kills, kite, map, version, ts,      // best run (only replaced when the score is higher)
  board: "v1",                                               // BOARD_VERSION from api/_config.js
  history: [ { score, wave, kills, kite, map, version, ts } ],   // newest first, max LIMITS.historyLength (50)
  updatedAt: Date }
```
Indexes: `{ board: 1, best: -1 }` (top list and rank), `{ updatedAt: 1 }`.

**`rate`** (rate limit counters, replaces Redis INCR with expiry):
```
{ _id: "<kind>:<key>:<hourBucket>", n: <int>, expireAt: Date }
```
Index: `{ expireAt: 1 }` with `expireAfterSeconds: 0` (TTL). `allow(kind, key, limit)` = `findOneAndUpdate({_id}, { $inc:{n:1}, $setOnInsert:{expireAt: now+1h} }, { upsert:true, returnDocument:'after' })` then `n <= limit`. Keep `clientIpHash` as the key for IP limits (never store raw IPs).

## Endpoint logic (same request and response shapes)
- **POST /api/submit**: validate with `checkRun`, rate limit (`sp` per player 10/h, `si` per IP-hash 30/h), then ONE atomic upsert so a lower score never overwrites the best:
  - Step 1: `updateOne({ _id: id }, { $set:{ name, board, updatedAt }, $push:{ history:{ $each:[run], $position:0, $slice: LIMITS.historyLength } }, $setOnInsert:{ best:-1 } }, { upsert:true })` (if the doc is new, `best:-1` guarantees step 2 matches).
  - Step 2: `updateOne({ _id: id, best: { $lt: run.score } }, { $set:{ best: run.score, wave, kills, kite, map, version, ts } })`.
  - Then `best = doc.best`, `rank = 1 + countDocuments({ board, best: { $gt: best } })`. Return `{ ok:true, rank, best }`.
  - Hide docs with `best:-1` from the board (filter `best: { $gte: 0 }` everywhere).
- **GET /api/top?limit=100**: `find({ board, best:{$gte:0} }).sort({ best:-1, ts:1 }).limit(limit)`, project `name, best, wave, ts, _id`; return `[ { rank, name, tag: tagOf(_id), score: best, wave, ts } ]`, same cache header as now.
- **GET /api/me?player_id=...**: `{ ok, rank, best }` (nulls when absent), rank computed as above.
- **POST /api/delete { player_id }**: `deleteOne({ _id })`, always answer `{ ok:true }`.
- **POST /api/admin/remove** (header `X-Admin-Token`): remove by `player_id`, or by `tag` (find `_id` starting with the lowercase 4-char prefix, case-insensitive; 409 `ambiguous_tag` with matches if more than one). Keep the current behaviour.
- Tag collisions: tags are 4 chars of the id, so they can repeat; that is accepted (names + tag are display only).

## Tests
- The current test suite uses an in-memory Redis stand-in. Replace it with `mongodb-memory-server` (devDependency) or a tiny in-memory fake of the few collection methods used; keep every existing test case (submit, lower score keeps best, bad names, implausible score, rate limit, me, delete, admin, ties, history cap 50).
- Add: concurrent double submit of two different scores keeps the higher; rank is correct with ties; TTL index exists on `rate.expireAt`.
- Never run tests against the Atlas cluster.

## Docs and policy updates (must match what the code does)
- `README.md`: database section becomes "MongoDB Atlas (free M0)": env vars `MONGODB_URI`, `MONGODB_DB`, `ADMIN_TOKEN`, `MAX_SCORE_PER_WAVE`; remove the Upstash steps.
- `public/privacy/index.html` and `PRIVACY.md`: change "Stored with Upstash on Vercel" to "Stored in a MongoDB Atlas database (data hosted by MongoDB, Inc.; the website and API run on Vercel)". Bump the policy version to 3 and the effective date. Keep everything else (player id, name, tag, scores, 1-hour scrambled network address for rate limiting, deletion routes).
- `/delete-data` page text: unchanged apart from the provider name if it is mentioned.
- `CONTEXT.md` section 6: replace "Upstash Redis" with MongoDB Atlas.
- Remove the `@upstash/redis` dependency and any `UPSTASH_*` env mentions.

## Definition of done
0. `api/_schema.js` is the only place that defines fields and limits; `grep` finds no duplicate regexes or field lists elsewhere, and a test asserts that every document written by every endpoint passes the `$jsonSchema` validator.
1. `npm test` passes with the Mongo-based code; no Redis code or dependency left.
2. With `MONGODB_URI` set locally, the manual checks in README ("Manual check after deploying") all pass against a **separate test database name** (`MONGODB_DB=changachett_test`), then the test database is dropped.
3. Deployed on Vercel with the env vars; `/leaderboard` shows a test entry, which is then deleted through `/api/delete`.
4. `grep -ri "mongodb+srv" .` finds only the placeholder in `.env.example` and this file's examples, and no password anywhere in the repo or git history.
5. Privacy policy version 3 is live and `PRIVACY.md` matches it.
