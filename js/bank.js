// bank.js — question bank validation + selection.
// Loading (fs in Node, fetch in the browser) is kept OUT of here; these
// functions operate on data they're handed, so they're testable and reusable.

// Validate the whole bank. Malformed rows are SKIPPED (logged), never fatal —
// one bad question must never white-screen the game mid-run.
export function validateBank(data, log = console.warn) {
  const errors = [];
  const cleaned = { meta: (data && data.meta) || {}, topics: {} };
  const topics = (data && data.topics) || {};

  for (const [topicKey, topic] of Object.entries(topics)) {
    cleaned.topics[topicKey] = { label: (topic && topic.label) || topicKey, levels: {} };
    const levels = (topic && topic.levels) || {};
    for (const [levelKey, rows] of Object.entries(levels)) {
      const kept = [];
      for (const q of Array.isArray(rows) ? rows : []) {
        const problem = questionError(q);
        if (problem) {
          const id = (q && q.id) || "(no id)";
          errors.push({ id, topic: topicKey, level: levelKey, error: problem });
          if (log) log(`[bank] skipped ${id} (${topicKey}/${levelKey}): ${problem}`);
          continue;
        }
        kept.push(q);
      }
      cleaned.topics[topicKey].levels[levelKey] = kept;
    }
  }
  return { ok: errors.length === 0, errors, cleaned };
}

// Returns an error string if the question is malformed, else null.
export function questionError(q) {
  if (!q || typeof q !== "object") return "not an object";
  if (!q.id) return "missing id";
  if (!q.prompt) return "missing prompt";
  if (q.type === "mc") {
    if (!Array.isArray(q.choices) || q.choices.length < 2) return "mc needs >= 2 choices";
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.choices.length) {
      return "mc answerIndex out of range";
    }
  } else if (q.type === "fib") {
    if (q.answer === undefined || q.answer === null || q.answer === "") return "fib missing answer";
  } else {
    return `unknown type: ${q.type}`;
  }
  return null;
}

export function getLevel(bank, topic, level) {
  const t = bank && bank.topics && bank.topics[topic];
  return (t && t.levels && t.levels[level]) || [];
}

// Shuffle-bag: emits every item once, in shuffled order, before any repeats —
// so a player never sees the same question twice until they've seen them all.
// rng is injectable so tests are deterministic.
export class ShuffleBag {
  constructor(items, rng = Math.random) {
    this._items = [...items];
    this._rng = rng;
    this._bag = [];
  }
  get size() { return this._items.length; }
  _refill() {
    this._bag = [...this._items];
    for (let i = this._bag.length - 1; i > 0; i--) {
      const r = this._rng();
      const raw = Math.floor((Number.isFinite(r) ? r : 0) * (i + 1)); // Fisher–Yates
      const j = Math.min(i, Math.max(0, raw)); // guard a misbehaving RNG (>=1 or NaN)
      [this._bag[i], this._bag[j]] = [this._bag[j], this._bag[i]];
    }
  }
  next() {
    if (this._items.length === 0) return undefined;
    if (this._bag.length === 0) this._refill();
    return this._bag.pop();
  }
}
