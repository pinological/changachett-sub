# Google Play Data safety: Changa Chett: Kite Fight

App: `com.pinological.changachett`, game 1.0.5. Policy: https://changachett.peterkarki.com.np/privacy (version 5).
Play Console path: Policy and programmes > App content > Data safety. Keep this file, the policy page and the Play form in step.

## Facts the form is based on
- Guest play by default (no account). Optional Google link (Android): the game sends the Google ID token to `POST /api/link`; the server verifies it with Google and stores only a SHA-256 of the Google account id plus the player id (collection `accounts`). No e-mail, Google id, Google name or token is stored. The Google display name is used on the phone only, to suggest a gamer name.
- Leaderboard (only when the player taps Submit): random player id, gamer name, score, wave, kills, kite, map, game version, date. Rate limiting uses a one-way hash of the IP kept for one hour.
- Ads: Google AdMob only (banner on menu and game-over, optional rewarded video). No Unity Ads, no analytics, no crash reporting known. No real-money purchases, no merchant account.
- Server: Vercel functions + MongoDB Atlas. Everything over HTTPS.
- Deletion: in-game "Delete my online data" (removes the board entry and the Google link), https://changachett.peterkarki.com.np/delete-data, or e-mail.

## Answers entered in Play Console
**Data collection and security**
- Collects or shares required data types: Yes. Encrypted in transit: Yes.
- Account creation methods: OAuth only. ("My app does not allow users to create an account" unticked.)
- Log in with accounts created outside the app: Yes (Google).
- Delete account URL and delete-data URL: https://changachett.peterkarki.com.np/delete-data (both).

**Data types** (everything else unticked: financial, health, messages, photos, audio, files, calendar, contacts, web browsing, email, precise location, diagnostics)

| Type | Collected | Shared | Ephemeral | Required | Collected for | Shared for |
|---|---|---|---|---|---|---|
| Personal info > Name (gamer name) | Yes | No | No | Optional | App functionality | n/a |
| Personal info > User IDs (player id, hashed Google id) | Yes | No | No | Optional | App functionality, Account management | n/a |
| Location > Approximate location (AdMob, from IP) | Yes | Yes | No | Required | Advertising or marketing, Analytics | Advertising or marketing, Analytics |
| App activity > App interactions (ad interactions) | Yes | Yes | No | Required | App functionality, Analytics, Advertising or marketing | Advertising or marketing, Analytics |
| App activity > Other actions (scores, wave, kills, kite, map) | Yes | No | No | Optional | App functionality | n/a |
| Device or other IDs (advertising id) | Yes | Yes | No | Required | Advertising or marketing | Advertising or marketing |

"Other user-generated content" was ticked first by mistake and replaced by "Other actions" (the game collects no free text besides the gamer name, which is under Name).

## Keep in step
- Adding any SDK (analytics, crash reporting, Unity Ads, Firebase) or any new data sent to the server: update this table, `public/privacy/index.html`, `PRIVACY.md` and the Play form before the release.
- Adding real-money purchases: also revisit Financial info and the merchant account.
- If `/delete-data` changes, re-check the two URLs in the form.

## Open items
- Done: `public/delete-data/index.html` says deleting also removes the hashed Google link.
- Submit the form (step 5) and check the Store listing preview. Under Collected: Name, User IDs, Approximate location, App interactions, Other actions, Device or other IDs. Under Shared: Approximate location, App interactions, Device or other IDs (AdMob gets the IP-based location and the advertising id).
