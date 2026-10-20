# CONTEXT.md: Changa Chett website + leaderboard (Vercel)

Give this file to the AI coding session. Build the whole thing in one new folder (for example `changachett-web/`), deploy to Vercel (Hobby, free) and serve it at **https://changachett.peterkarki.com.np**.

## 1. The product
**Changa Chett: Kite Fight** is a free 3D Android kite-fighting game made in Godot 4.7 by Peter Karki (Nepal). The player flies a kite over Nepali skylines during Dashain, dives across rival kites' strings and cuts them. "Changa Chett" is what Nepali kids shout when a kite is cut.
- Package: `com.pinological.changachett`. Version 1.0.0. Android 7.0+, 64-bit. Free, offline, contains ads (menus and game-over only).
- Features: one-thumb swipe and dive controls, RAGE mode (red-hot string), 12 Nepali kites (Sayapatri, Neel Himal, Taleju, Garuda, Lakhe...), 3 tricks (Barrel Roll, Loop-the-Loop, Razor Spin), 5 skylines (Kathmandu Valley, Boudhanath, Dharahara, Basantapur Durbar Square, Swayambhu), weather, upgrades, coins and diamonds, premium rival kites with bounties.
- Tone: friendly, proud, festive, family friendly. Short sentences. No hype claims, no promised dates or rewards.

## 2. Links
- itch.io (Android APK now): https://pinological.itch.io/changa-chett
- Tester sign-up form: https://forms.gle/2Zg98kkJ8AN7hJGt6
- Google Play: not live yet (closed test running). Show a "Coming soon on Google Play" badge, no link.
- Contact: peter.karki0422@gmail.com (put it in one config constant).
- Developer: Peter Karki, https://peterkarki.com.np

## 3. Brand and design
Look: a flat, warm dusk poster. Hand-made game-UI feel, not a corporate SaaS template. No stock gradients-on-everything, no AI-looking art. Use the real game images below.

**Palette** (from the game):
| Name | Hex | Use |
|---|---|---|
| Indigo | `#1E1B3A` | text, dark backgrounds, outlines |
| Cream | `#FFF3DC` | page background, text on dark |
| Marigold | `#FFC93C` | highlights, hover, accents |
| Crimson | `#C8102E` | primary buttons, ribbon, RAGE |
| Dusk plum | `#4E2A6C` / `#76467A` | section backgrounds, mountains |
| Sunset orange | `#FFA450` / `#EC6254` | gradients and flags |

Cover sky gradient (top to bottom): `#341A62`, `#8A3470`, `#EC6254`, `#FFA450`, `#FFCC70`.

**Typography:** **Baloo 2** (Google Font, ExtraBold 800 for titles, Bold 700 for buttons and labels, Regular for body). Title style: cream text with a thick indigo outline and a flat dark offset shadow. Tagline sits in a crimson ribbon with a marigold border: "NEPAL'S DASHAIN KITE BATTLE".

**Shapes:** rounded buttons (radius about 14px), a flat offset shadow instead of blur, big touch targets. Optional decorative prayer-flag strip, layered mountain silhouettes, a stupa spire.

**Layout rules:** mobile first (most visitors come from a phone), 16px side gutters, no horizontal scroll, dark text on cream for body copy, check colour contrast (WCAG AA), support `prefers-reduced-motion`.

## 4. Image and video locations (absolute paths on Peter's PC)
Project root: `D:\project\Kites-20261014T150719Z-1-001\Kites\mcptest\mcptest\`
Copy what you need into the web project's `public/` folder, and convert big PNGs to WebP or optimised JPG.

| Asset | Path (relative to project root) |
|---|---|
| Cover art 1260x1000 | `docs\store\itch\cover.png` (630x500 copy: `cover_630x500.png`) |
| Wide banner 1600x400 | `docs\store\itch\form_header.png` |
| Play feature graphic 1024x500 | `docs\store\feature_graphic.png` |
| App icon 512 | `docs\store\icon_512.png` (vector source: `kite\ui\fonts\icon.svg`) |
| Screenshots (1920x1080) | `docs\store\screenshots\01_hero.png`, `02_action_day.png`, `03_action_rage.png`, `04_kites_lineup.png`, `05_maps.png`, `06_shop_tab1.png`, `07_shop_tab2.png` |
| Raw captures (menu, game over, five maps, shop) | `docs\store\raw\` (`menu.png`, `game_over.png`, `map_0..4.png`, `hero_bg.jpg`) |
| Transparent kite cut-outs (for decoration) | `docs\store\raw\cutout_1.png`, `_4`, `_6`, `_8`, `_9`, `_11`, `_12` |
| Gameplay clips (MP4, H.264, 1080p) | `docs\promo\footage\c01_flyover_valley.mp4`, `c01_flyover_boudha.mp4`, `c01_flyover_dharahara.mp4`, `c01_flyover_basantapur.mp4`, `c01_flyover_swayambhu.mp4`, `c02_cuts_day.mp4`, `c03_rage.mp4`, `c04_premium.mp4`, `c05_trick.mp4`, `c06_shop.mp4` |
| Font file | `kite\ui\fonts\Baloo2.ttf` (licence `OFL_Baloo2.txt`); on the web use Google Fonts |
| Copy text (store listing, itch description) | `docs\store\LISTING.md`, `docs\store\itch\ITCH_PAGE.md` |
| Draft privacy policy | `docs\store\privacy_policy.html` |

## 5. Pages to build
1. **`/` Landing:** hero with cover art, title, tagline, buttons: "Download APK (itch.io)", "Become a tester", disabled "Google Play: coming soon". Then: feature cards, screenshot gallery, gameplay video (autoplay muted loop of `c02_cuts_day.mp4`, with a poster image), the five skylines, the 12 kites, FAQ (install steps, Android 7+, why uninstall before the Play version), footer with links.
2. **`/privacy`:** privacy policy (section 7), plain readable HTML, linked from the footer and the app.
3. **`/leaderboard`:** top 100, columns rank, name with tag, best score, wave, date. Tabs: All-time (this version only).
4. **`/delete-data`:** short page and form so players can request deletion of their leaderboard record (id plus name), also works by email. Needed for Google Play.
5. Basic SEO: title, meta description, Open Graph image (cover), `robots.txt`, `sitemap.xml`, favicon from the icon.

## 6. Leaderboard API (Vercel serverless functions)
Use Vercel Functions in `/api` with a free **MongoDB Atlas** (M0) database: one `players` document per player (best run, name, board version, last 50 runs) and a `rate` collection with a TTL index for rate limits. Fields, limits and validators live in `api/_schema.js` (see `MONGODB.md`). Keep stored data tiny (text only).

Player model (no login, no recovery): the game creates a random 32-hex-character `player_id` on first launch and keeps it on the phone. The name is a label only and can be edited in the app's Profile. The public tag is the first 4 characters of the id, shown as `Name#4F2A`.

Endpoints:
- `POST /api/submit` body: `{ player_id, name, score, wave, kills, kite, map, version, ts }`
  - Validate: `player_id` matches `^[0-9a-f]{32}$`; name 2 to 14 characters, letters, numbers, spaces, `_` and `-` only; score integer within sane limits (reject above a max per wave, configurable); `ts` within the last 30 days; body under 1 KB.
  - Name filter: reject a blocklist of swearing and insults in English and common Nepali and Hindi romanised words (keep the list in one file, easy to extend). Reject names that look like phone numbers or emails.
  - Rate limit: 10 submits per `player_id` per hour and 30 per IP per hour.
  - Update the player's best score only if higher, update their name to the latest, and also push to history. Return `{ ok, rank, best }`.
- `GET /api/top?limit=100` returns the list `[ { rank, name, tag, score, wave, ts } ]`. Cache for 30 seconds.
- `GET /api/me?player_id=...` returns the player's rank and best.
- `POST /api/delete` body `{ player_id }` deletes all their data. Return `{ ok }`.
- `POST /api/admin/remove` protected by the env var `ADMIN_TOKEN` (header), removes a player. Use it to take down cheaters or inappropriate names.
- All responses JSON, CORS allowed (the game calls it from the app), no cookies, no analytics, no personal data in logs.

Honest limits to mention in code comments: with no login, scores can be faked. Plausibility limits, rate limits and the admin remove tool are the only defences, and that is accepted.

## 7. Privacy policy content (must be accurate)
- Developer: Peter Karki, contact email peter.karki0422@gmail.com. App: Changa Chett: Kite Fight, `com.pinological.changachett`. Intended for ages 13+.
- Collected by the app on the device: game progress and settings (stored locally).
- Collected by our server only if the player taps submit: chosen gamer name, random player id, scores and run details (wave, kills, kite, map, version, date). Not linked to a real identity. Retained until the player asks for deletion (in-app button, `/delete-data`, or email).
- Ads: Google AdMob (and Unity Ads through AdMob mediation). These may collect the advertising ID, IP address, device and usage data, and may show personalised ads. EEA/UK users get a consent prompt (Google UMP). Links: https://policies.google.com/technologies/ads and https://unity.com/legal/privacy-policy
- No sale of data, no account, no location collection, no children under 13.
- Rights: access, deletion on request, contact email. Policy date and version at the top; changes are posted on this page.
- Start from `docs\store\privacy_policy.html`, then update it for the leaderboard and Unity Ads.

## 8. Tech and quality
- Stack suggestion: plain static HTML, CSS and a little JS, or Astro, or Next.js. Keep it light: Lighthouse performance 90+ on mobile, images in WebP with width and height set, lazy loading, no heavy frameworks for a landing page. Vercel Functions in TypeScript or JS for `/api`.
- No tracking cookies and no analytics, so no cookie banner is needed. If analytics are added later, use a cookieless one and update the policy.
- Environment variables: `MONGODB_URI`, `MONGODB_DB`, `ADMIN_TOKEN`, `MAX_SCORE_PER_WAVE`.
- Security headers in `vercel.json` (CSP, X-Content-Type-Options, Referrer-Policy). Escape every name before rendering it.
- Domain: add `changachett.peterkarki.com.np` in Vercel (CNAME `changachett` to the value Vercel shows). Peter does the DNS part.
- Deliver: the code, a README with deploy steps, and a short test list (submit, rate limit, bad name, delete).

## 9. Out of scope for now
Accounts, passwords, recovery codes, weekly boards, friends, chat, payments, a pending upload queue in the game. The game side (Godot HTTP calls, Profile screen, History screen) will be done in the game project separately and will use the endpoints in section 6, so keep their shapes stable.
