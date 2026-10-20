// One-off: create the collections with validators and indexes from api/_schema.js.
// The app user (read/write only) can create collections and indexes but not change the validator of an
// existing collection, so run this once with a user that has dbAdmin on the database:
//   node --env-file=.env.local scripts/setup-db.mjs
import { ensureDb, mongo } from '../api/_lib.js';

const { client, db } = await mongo(); // mongo() already runs ensureDb; run it again to surface any error
try {
  await ensureDb(db);
  const info = await db.listCollections({}, { nameOnly: false }).toArray();
  for (const c of info) console.log(c.name, c.options?.validator ? 'validator: yes' : 'validator: NO', c.options?.validationLevel || '');
} finally {
  await client.close();
}
