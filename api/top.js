// GET /api/top?limit=100  -> [ { rank, name, tag, score, wave, ts } ]
import { LIMITS, topRow } from './_schema.js';
import { begin, fail, mongo, send, topDocs } from './_lib.js';

export default async function handler(req, res) {
  if (!begin(req, res, 'GET')) return;
  const url = new URL(req.url, 'http://x');
  const limit = Math.min(LIMITS.topMax, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || LIMITS.topMax));

  try {
    const docs = await topDocs(await mongo(), limit);
    send(res, 200, docs.map((d, i) => topRow(d, i + 1)), 'public, max-age=30, s-maxage=30, stale-while-revalidate=30');
  } catch {
    fail(res, 500, 'server_error');
  }
}
