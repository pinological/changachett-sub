// POST /api/delete  { player_id }  -> { ok }
// Deletes the player's document (board entry, profile and history). Answers ok even if nothing
// was stored, so the endpoint does not reveal which ids exist.
import { LIMITS } from './_schema.js';
import { allow, begin, clientIpHash, fail, isPlayerId, mongo, readBody, removePlayer, send } from './_lib.js';

export default async function handler(req, res) {
  if (!begin(req, res, 'POST')) return;
  const body = readBody(req, res);
  if (!body) return;
  if (!isPlayerId(body.player_id)) return fail(res, 400, 'bad_player_id');

  try {
    const store = await mongo();
    if (!(await allow(store, 'di', clientIpHash(req), LIMITS.deletesPerIpPerHour))) return fail(res, 429, 'rate_limited');
    await removePlayer(store, body.player_id);
    send(res, 200, { ok: true });
  } catch {
    fail(res, 500, 'server_error');
  }
}
