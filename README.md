# Changa Chett website + leaderboard

Static site in `public/` (no build step) plus a tiny leaderboard API in `api/` (Vercel Functions + MongoDB Atlas).
`CONTEXT.md` has the full brief (brand, API shapes, privacy facts); `MONGODB.md` the database brief.
**`api/_schema.js` is the single source of truth** for fields, limits, regexes, MongoDB validators, indexes and output shapes.

| Path | What |
|---|---|
| `/` | Landing page (`public/index.html`, script in `public/js/home.js`) |
| `/leaderboard` | Top 100, all-time for the current board version |
| `/privacy` | Privacy policy, version 3 (leaderboard, Unity Ads, MongoDB Atlas). `PRIVACY.md` is a short copy |
| `/delete-data` | Players delete their leaderboard record (form or email). Needed for Google Play |
| `/robots.txt`, `/sitemap.xml`, `/404` | SEO and not-found page |
| `api/submit`, `api/top`, `api/me`, `api/delete`, `api/admin/remove` | Leaderboard API, see below |

Contact email lives in `public/js/config.js` (browser) and `api/_config.js` (server). Name blocklist: `api/_blocklist.js`.

## Deploy on Vercel (free Hobby plan)
1. Install the CLI once: `npm i -g vercel`. In this folder run `vercel` (framework: **Other**; the output directory `public` is already set in `vercel.json`), then `vercel --prod`.
   Or push to GitHub and import the repo on vercel.com (Add New > Project, Framework: Other).
2. **Database: MongoDB Atlas (free M0)**, cluster `changachettdb`, database `changachett`.
   - Atlas > Database Access: an app-only user with **Read and write to a specific database** > `changachett` (not Atlas admin), with a long random password.
   - Atlas > Network Access: `0.0.0.0/0` (Vercel's IPs change), so the password is the only gate.
   - Validators and indexes are created automatically on first use. With a read/write-only user, run `npm run setup-db` once using an admin user in `.env.local` so the validators are applied to existing collections.
3. **Env vars** (Settings > Environment Variables, for Production, Preview and Development; see `.env.example`):
   - `MONGODB_URI`: the Atlas connection string for the app user. Never put it in a committed file; locally it lives in `.env.local` (git-ignored).
   - `MONGODB_DB`: `changachett`
   - `ADMIN_TOKEN`: long random string, e.g. `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
   - `MAX_SCORE_PER_WAVE`: highest believable score per wave (default 5000). Set it from real play data.
   - Redeploy after adding env vars (`vercel --prod`).
4. **Domain:** Settings > Domains > add `changachett.peterkarki.com.np`. At the DNS provider for `peterkarki.com.np` add `CNAME changachett` to the value Vercel shows (usually `cname.vercel-dns.com`; on Cloudflare use DNS only, grey cloud).
5. Play Console > App content: Privacy policy `https://changachett.peterkarki.com.np/privacy`, Data deletion `https://changachett.peterkarki.com.np/delete-data`.

## API (shapes are fixed; the game depends on them)
All JSON, CORS `*`, no cookies. Errors are `{ "ok": false, "error": "<code>" }`.

| Call | Body / query | Returns |
|---|---|---|
| `POST /api/submit` | `{ player_id, name, score, wave, kills, kite, map, version, ts }` (`ts` in Unix seconds; ms also accepted) | `{ ok, rank, best }` |
| `GET /api/top?limit=100` | | `[ { rank, name, tag, score, wave, ts } ]`, cached 30 s |
| `GET /api/me?player_id=...` | | `{ ok, rank, best }` (nulls if not on the board) |
| `POST /api/delete` | `{ player_id }` | `{ ok }` |
| `POST /api/admin/remove` | header `X-Admin-Token: <ADMIN_TOKEN>`; body `{ player_id }` or `{ tag: "4F2A" }` | `{ ok, removed }`, or 409 `ambiguous_tag` with matches |

Rules: `player_id` is 32 lowercase hex; name 2-14 chars (letters, numbers, space, `_`, `-`, at least one letter), no blocklisted words, not phone- or email-like; `score <= wave * MAX_SCORE_PER_WAVE`; `ts` within the last 30 days; body under 1 KB. Rate limits: 10 submits per player and 30 per IP per hour (429 `rate_limited`). Best score only goes up; the name always follows the latest submit; the last 50 runs are kept as history.

Honest limit: there is no login, so scores can be faked by calling the API directly. Plausibility checks, rate limits and the admin tool are the defences. To start a fresh board for a new game version, change `BOARD_VERSION` in `api/_config.js`.

Take down a cheater or a rude name:
```bash
curl -X POST https://changachett.peterkarki.com.np/api/admin/remove -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"tag":"4F2A"}'
```

## Tests
Automated: `npm install` then `npm test`. Runs every endpoint against a throwaway local MongoDB (`mongodb-memory-server`, downloads a MongoDB binary on first run), never Atlas. Covers submit, best-only-goes-up, concurrent submits, ties, history cap 50, bad names, implausible scores, rate limits, TTL index, schema validation, me, delete and admin.

Local Windows note: if Node fails with `querySrv ECONNREFUSED` on a `mongodb+srv` URI, add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `.env.local`.

Manual check after deploying (replace the id with your own 32-hex value):
```bash
BASE=https://changachett.peterkarki.com.np
ID=0123456789abcdef0123456789abcdef
NOW=$(date +%s)
```
1. **Submit:** `curl -X POST $BASE/api/submit -H "Content-Type: application/json" -d "{\"player_id\":\"$ID\",\"name\":\"Tester\",\"score\":1200,\"wave\":3,\"kills\":9,\"kite\":\"sayapatri\",\"map\":\"boudha\",\"version\":\"1.1.0\",\"ts\":$NOW}"` gives `{"ok":true,"rank":1,"best":1200}`. Open `/leaderboard`; `Tester#0123` appears within 30 s.
2. **Lower score keeps best:** submit again with `"score":500` gives `best` 1200.
3. **Bad name:** `"name":"fuck you"` gives 400 `name_not_allowed`; `"name":"9841234567x"` gives 400 `name_looks_like_phone`; `"name":"<b>"` gives 400 `name_chars`.
4. **Implausible score:** `"score":999999,"wave":1` gives 400 `score_implausible`.
5. **Rate limit:** run the submit 11 times in a row; the 11th gives 429 `rate_limited`.
6. **Me:** `curl "$BASE/api/me?player_id=$ID"` gives rank and best.
7. **Delete:** use `/delete-data` with the id (or `curl -X POST $BASE/api/delete -H "Content-Type: application/json" -d "{\"player_id\":\"$ID\"}"`); `/api/me` then returns nulls and the name leaves the board within a minute.
8. **Admin:** `/api/admin/remove` without the header gives 401; with it, removes the player.
9. **Pages:** `/`, `/leaderboard`, `/privacy`, `/delete-data`, `/nope` (404) on a phone; no sideways scrolling.

## Before going public
- Set `MAX_SCORE_PER_WAVE` from real scores so honest players are never rejected.
- The game side (HTTP calls, Profile with the player id and a "Delete my online data" button) is built in the Godot project; the policy and `/delete-data` already mention that button.
- The Google Play button is disabled; turn it into a link when the game is live.
- Keep the privacy policy date and version in step with the game.
