// GET /api/me?player_id=...  -> { ok, rank, best }   (rank and best are null if not on the board)
import { begin, bestOf, fail, isPlayerId, mongo, rankOf, send } from './_lib.js';

export default async function handler(req, res) {
  if (!begin(req, res, 'GET')) return;
  const id = new URL(req.url, 'http://x').searchParams.get('player_id');
  if (!isPlayerId(id)) return fail(res, 400, 'bad_player_id');

  try {
    const store = await mongo();
    const best = await bestOf(store, id);
    send(res, 200, { ok: true, rank: await rankOf(store, best), best });
  } catch {
    fail(res, 500, 'server_error');
  }
}
