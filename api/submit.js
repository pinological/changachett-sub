// POST /api/submit  { player_id, name, score, wave, kills, kite, map, version, ts }
// -> { ok, rank, best }
import { LIMITS } from './_schema.js';
import { allow, begin, checkRun, clientIpHash, fail, mongo, rankOf, readBody, saveRun, send } from './_lib.js';

export default async function handler(req, res) {
  if (!begin(req, res, 'POST')) return;
  const body = readBody(req, res);
  if (!body) return;
  const { run, error } = checkRun(body);
  if (error) return fail(res, 400, error);

  try {
    const store = await mongo();
    if (!(await allow(store, 'sp', run.player_id, LIMITS.submitsPerPlayerPerHour))) return fail(res, 429, 'rate_limited');
    if (!(await allow(store, 'si', clientIpHash(req), LIMITS.submitsPerIpPerHour))) return fail(res, 429, 'rate_limited');
    const best = await saveRun(store, run);
    send(res, 200, { ok: true, rank: await rankOf(store, best), best });
  } catch {
    fail(res, 500, 'server_error');
  }
}
