// The ONE source of truth for the leaderboard data: field names, types, limits, regexes,
// MongoDB validators, document builders, indexes and public output shapes.
// Endpoints, validation (_lib.js), tests and any script import from here; nothing else defines them.
// The Godot game (kite/core/online.gd, kite/menu/leaderboard_panel.gd) depends on the request and
// output shapes below, so never rename a field without updating the game in the same release.

// Bump when a new game version should start a fresh board ("all-time, this version only").
export const BOARD_VERSION = 'v1';

export const COLLECTIONS = { players: 'players', rate: 'rate' };

export const LIMITS = {
  bodyBytes: 1024,
  maxScorePerWave: Number(process.env.MAX_SCORE_PER_WAVE) || 5000, // configurable per deploy
  maxScoreAbsolute: 10_000_000,
  maxWave: 999,
  maxKills: 100_000,
  nameMin: 2,
  nameMax: 14,
  textMax: 24, // kite, map
  versionMax: 16,
  boardMax: 16,
  rateIdMax: 120,
  tsMaxAgeSec: 30 * 24 * 3600, // runs older than 30 days are rejected
  tsMaxFutureSec: 10 * 60, // allow small phone clock drift
  submitsPerPlayerPerHour: 10,
  submitsPerIpPerHour: 30,
  deletesPerIpPerHour: 30,
  historyLength: 50,
  topMax: 100,
  noScore: -1, // `best` of a player who is registered but not on the board yet
};

export const PATTERNS = {
  playerId: /^[0-9a-f]{32}$/,
  name: /^[A-Za-z0-9 _-]+$/,
  nameLetter: /[A-Za-z]/,
  text: /^[A-Za-z0-9_ -]{0,24}$/, // kite ("kite0"...), map ("valley", "boudha"...)
  version: /^[0-9A-Za-z.+-]{0,16}$/, // "1.0.0"
  tag: /^[0-9a-fA-F]{4}$/,
};

// Request body of POST /api/submit. Every field except player_id/name is also a history entry.
export const RUN_REQUEST_FIELDS = ['player_id', 'name', 'score', 'wave', 'kills', 'kite', 'map', 'version', 'ts'];
// Fields of one history entry, and of the best run copied onto the player document.
export const RUN_FIELDS = ['score', 'wave', 'kills', 'kite', 'map', 'version', 'ts'];
export const BEST_RUN_FIELDS = ['wave', 'kills', 'kite', 'map', 'version', 'ts']; // `score` is stored as `best`

const NUM = ['int', 'long', 'double'];

export const VALIDATORS = {
  players: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'name', 'board', 'best', 'updatedAt'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string', pattern: PATTERNS.playerId.source },
        name: { bsonType: 'string', minLength: LIMITS.nameMin, maxLength: LIMITS.nameMax },
        board: { bsonType: 'string', maxLength: LIMITS.boardMax },
        best: { bsonType: NUM, minimum: LIMITS.noScore },
        wave: { bsonType: NUM, minimum: 0 },
        kills: { bsonType: NUM, minimum: 0 },
        kite: { bsonType: 'string', maxLength: LIMITS.textMax },
        map: { bsonType: 'string', maxLength: LIMITS.textMax },
        version: { bsonType: 'string', maxLength: LIMITS.versionMax },
        ts: { bsonType: NUM },
        updatedAt: { bsonType: 'date' },
        history: {
          bsonType: 'array',
          maxItems: LIMITS.historyLength,
          items: {
            bsonType: 'object',
            required: ['score', 'wave', 'kills', 'ts'],
            additionalProperties: false,
            properties: {
              score: { bsonType: NUM, minimum: 0 },
              wave: { bsonType: NUM, minimum: 1 },
              kills: { bsonType: NUM, minimum: 0 },
              kite: { bsonType: 'string', maxLength: LIMITS.textMax },
              map: { bsonType: 'string', maxLength: LIMITS.textMax },
              version: { bsonType: 'string', maxLength: LIMITS.versionMax },
              ts: { bsonType: NUM },
            },
          },
        },
      },
    },
  },
  rate: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'n', 'expireAt'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string', maxLength: LIMITS.rateIdMax },
        n: { bsonType: ['int', 'long'], minimum: 1 },
        expireAt: { bsonType: 'date' },
      },
    },
  },
};

export const INDEXES = {
  players: [
    { key: { board: 1, best: -1, ts: 1 }, options: { name: 'board_best_ts' } }, // top list and rank
    { key: { updatedAt: 1 }, options: { name: 'updatedAt' } },
  ],
  rate: [{ key: { expireAt: 1 }, options: { name: 'expireAt_ttl', expireAfterSeconds: 0 } }],
};

/** One history entry from a validated run. */
export function newRunDoc(run) {
  return Object.fromEntries(RUN_FIELDS.map((f) => [f, run[f]]));
}

/** A full player document as stored after this run is the player's best (used by tests and scripts). */
export function newPlayerDoc(run, { board = BOARD_VERSION, now = new Date() } = {}) {
  return {
    _id: run.player_id,
    name: run.name,
    board,
    best: run.score,
    ...Object.fromEntries(BEST_RUN_FIELDS.map((f) => [f, run[f]])),
    updatedAt: now,
    history: [newRunDoc(run)],
  };
}

/** Public output shapes. */
export const OUTPUT = {
  topRow: ['rank', 'name', 'tag', 'score', 'wave', 'ts'],
  submit: ['ok', 'rank', 'best'],
  me: ['ok', 'rank', 'best'],
  errorCodes: ['bad_player_id', 'name_missing', 'name_length', 'name_chars', 'name_needs_letter', 'name_looks_like_phone',
    'name_looks_like_email', 'name_not_allowed', 'bad_wave', 'bad_kills', 'bad_score', 'score_implausible', 'bad_ts',
    'bad_kite', 'bad_map', 'bad_version', 'rate_limited', 'server_error', 'bad_json', 'body_too_large', 'method_not_allowed',
    'unauthorized', 'need_player_id_or_tag', 'ambiguous_tag'],
};

/** Public top-list row from a player document. */
export function topRow(doc, rank) {
  return { rank, name: String(doc.name), tag: String(doc._id).slice(0, 4).toUpperCase(), score: Number(doc.best), wave: Number(doc.wave) || 0, ts: Number(doc.ts) || 0 };
}
