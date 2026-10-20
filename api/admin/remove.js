// POST /api/admin/remove   header: X-Admin-Token: <ADMIN_TOKEN>  (or Authorization: Bearer <ADMIN_TOKEN>)
// body: { player_id }  or  { tag: "4F2A" }  (the 4-character tag shown on the board)
// -> { ok, removed: [player_id...] }   or, when a tag matches several players, 409 { ok: false, error: "ambiguous_tag", matches: [...] }
import { PATTERNS } from '../_schema.js';
import { begin, fail, findByTag, isPlayerId, mongo, readBody, removePlayer, safeEqual, send } from '../_lib.js';

export default async function handler(req, res) {
  if (!begin(req, res, 'POST')) return;
  const secret = process.env.ADMIN_TOKEN;
  const given = req.headers['x-admin-token'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secret || secret.length < 16 || !safeEqual(given, secret)) return fail(res, 401, 'unauthorized');

  const body = readBody(req, res);
  if (!body) return;

  try {
    const store = await mongo();
    let ids;
    if (isPlayerId(body.player_id)) ids = [body.player_id];
    else if (typeof body.tag === 'string' && PATTERNS.tag.test(body.tag)) {
      const matches = await findByTag(store, body.tag);
      if (matches.length > 1) return send(res, 409, { ok: false, error: 'ambiguous_tag', matches: matches.map((m) => ({ player_id: m._id, name: m.name })) });
      ids = matches.map((m) => m._id);
    } else return fail(res, 400, 'need_player_id_or_tag');

    for (const id of ids) await removePlayer(store, id);
    send(res, 200, { ok: true, removed: ids });
  } catch {
    fail(res, 500, 'server_error');
  }
}
