// POST /api/link  { player_id, id_token }  -> { ok, player_id, name, restored }
// Links the player's leaderboard id to a Google account (see _lib.js). `player_id` in the answer is the id the game
// must use from now on (a different one when the Google account was already linked on another phone).
import { LIMITS } from './_schema.js';
import { accountHash, allow, begin, clientIpHash, fail, google, isPlayerId, linkAccount, mongo, readBody, send } from './_lib.js';

export default async function handler(req, res) {
  if (!begin(req, res, 'POST')) return;
  const body = readBody(req, res, LIMITS.linkBodyBytes);
  if (!body) return;
  if (!isPlayerId(body.player_id)) return fail(res, 400, 'bad_player_id');

  try {
    const store = await mongo();
    if (!(await allow(store, 'li', clientIpHash(req), LIMITS.linksPerIpPerHour))) return fail(res, 429, 'rate_limited');
    const sub = await google.verify(body.id_token);
    if (!sub) return fail(res, 401, 'bad_token');
    const out = await linkAccount(store, accountHash(sub), body.player_id);
    if (out.error) return fail(res, 409, out.error);
    send(res, 200, { ok: true, ...out });
  } catch {
    fail(res, 500, 'server_error');
  }
}
