// records.js — the best distance a player has reached, per topic and level.
//
// Why per topic+level rather than one number: there are 4 topics × 3 levels, so
// this gives twelve things to beat instead of one, and a player who is strong at
// ratios but shaky at coordinates gets credit for both. It also means a best
// score can't be "stolen" by playing the easiest level.
//
// Kept separate from settings.js on purpose: settings are preferences the
// player sets, records are earned facts about their play. Mixing them would
// mean a corrupt record could reset someone's colours, and vice versa.
//
// Same storage discipline as settings: storage is injected so this tests in
// Node, and reading localStorage is guarded because browsers set to block all
// cookies THROW on access (common on school laptops).

const KEY = "mathslope.records";

export function keyFor(topic, level) {
  return `${topic}:${level}`;
}

// Distances are whole metres, never negative, never absurd. Anything else in
// storage is dropped rather than trusted — a hand-edited or corrupt file must
// not be able to put "999999999 m" on the board, and must never crash the game.
const MAX_SANE = 10_000_000;

export function sanitizeRecords(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || !k.includes(":")) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SANE) continue;
    out[k] = Math.floor(n);
  }
  return out;
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null; // storage blocked → play without records, don't crash
  }
}

export function loadRecords(storage = defaultStorage()) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return {};
    return sanitizeRecords(JSON.parse(raw));
  } catch {
    return {}; // corrupt JSON or no storage → no records, still playable
  }
}

export function saveRecords(records, storage = defaultStorage()) {
  const clean = sanitizeRecords(records);
  try {
    storage && storage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable (private mode / quota) — the run still counts on screen */
  }
  return clean;
}

// 0 means "nothing set yet" — the caller decides whether to show anything.
export function bestFor(records, topic, level) {
  const v = records[keyFor(topic, level)];
  return Number.isFinite(v) ? v : 0;
}

// Pure: returns the new record set plus what happened, so the UI can say
// "new best" without re-deriving it. A first-ever run counts as a best only if
// the player actually got somewhere (0 m is not an achievement).
export function recordDistance(records, topic, level, meters) {
  const previous = bestFor(records, topic, level);
  const m = Number.isFinite(meters) ? Math.floor(meters) : 0;
  const isBest = m > previous && m > 0;
  const next = isBest ? { ...records, [keyFor(topic, level)]: m } : records;
  return { records: next, isBest, previous, meters: m };
}
