// validate.js — answer checking for the math gate.
// Pure functions, no DOM, no globals: the same code runs under Node tests and
// in the browser. This is the riskiest correctness surface (kids type answers
// many ways), so it is built and tested before anything is drawn.

const UNICODE_MINUS = /−/g; // − (U+2212) → ASCII "-"

// Normalize a raw typed answer to a comparable string.
export function normalizeFib(raw) {
  return String(raw ?? "")
    .replace(UNICODE_MINUS, "-")
    .trim()
    .replace(/\s+/g, " ");
}

// Multiple-choice: the selected index equals the answer index.
// Accepts a numeric or numeric-string index (e.g. "0" from a DOM dataset).
export function checkMc(choiceIndex, q) {
  const i = Number(choiceIndex);
  return Number.isInteger(i) && i === q.answerIndex;
}

// Fill-in-the-blank: normalize, try every accepted literal form, then fall to
// the question's validate mode. Empty/garbage is wrong — never a NaN trap.
export function checkFib(raw, q) {
  const norm = normalizeFib(raw);
  if (norm === "") return false;

  const literals = [q.answer, ...(q.accept || [])]
    .map((a) => normalizeFib(a).toLowerCase());
  if (literals.includes(norm.toLowerCase())) return true;

  const mode = q.validate || "exact";
  // A kid answering "x = ?" will often type the whole equation back: "x=7",
  // "X = 7", "m=2". For math modes (never for word answers), strip a leading
  // single-letter "=" so the value is what gets judged.
  const stripped = mode === "exact" ? norm : norm.replace(/^[a-z]\s*=\s*/i, "");

  switch (mode) {
    case "numeric": return checkNumeric(stripped, q.answer, q.tol);
    case "fraction": return checkFraction(stripped, q.answer);
    case "coordinate": return checkCoordinate(stripped, q.answer);
    case "exact": return false; // exact already handled by the literal pass above
    default: return false;
  }
}

// Unified entry point used by the game loop.
export function checkAnswer(raw, q) {
  return q.type === "mc" ? checkMc(raw, q) : checkFib(raw, q);
}

// ---- internal numeric helpers ----

// Strip thousands-grouping commas ("15,625" → "15625", "1,000,000" → "1000000")
// but leave a lone decimal comma like "0,5" untouched (it stays rejected
// downstream rather than being silently mangled into "05").
// How the regex reads: remove a comma only when a digit is right before it
// (?<=\d) AND exactly three digits follow it (?=\d{3}) with no fourth (?!\d) —
// so "15,625" matches but "0,5" and "1,23" don't.
function stripGrouping(s) {
  return String(s).replace(/(?<=\d),(?=\d{3}(?!\d))/g, "");
}

// Kids answer with the units the prompt used: "60 mph", "12 dollars", "$ 12",
// "12$", "$3 per item". Strip a leading currency sign and a trailing unit
// word so the number is what gets judged.
function stripUnits(s) {
  return String(s)
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/\s*(mph|miles per hour|dollars?|bucks|per item|\$)\s*\.?$/i, "")
    .trim();
}

// Parse "12", "-3", "1/2", "0.5", ".5", "8.", "15,625" → Number, else NaN.
function parseNumber(s) {
  const t = stripGrouping(stripUnits(s));
  const frac = t.match(/^([-+]?\d*\.?\d+)\s*\/\s*([-+]?\d*\.?\d+)$/);
  if (frac) {
    const d = parseFloat(frac[2]);
    if (d === 0) return NaN;
    return parseFloat(frac[1]) / d;
  }
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return parseFloat(t);
  return NaN;
}

function checkNumeric(norm, answer, tol = 0.001) {
  const got = parseNumber(norm);
  const want = parseNumber(answer);
  if (Number.isNaN(got) || Number.isNaN(want)) return false;
  return Math.abs(got - want) <= tol;
}

// Parse to a reduced-comparison rational {n, d}; supports "a/b" and decimals.
function parseRational(s) {
  const t = stripGrouping(stripUnits(s));
  const frac = t.match(/^([-+]?\d+)\s*\/\s*([-+]?\d+)$/);
  if (frac) {
    const d = parseInt(frac[2], 10);
    if (d === 0) return null;
    return { n: parseInt(frac[1], 10), d };
  }
  if (/^[-+]?\d+$/.test(t)) return { n: parseInt(t, 10), d: 1 };
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) {
    const decimals = (t.split(".")[1] || "").length;
    const den = 10 ** decimals;
    return { n: Math.round(parseFloat(t) * den), d: den };
  }
  return null;
}

// Fraction equality by cross-multiply, so 1/2 ≡ 0.5 ≡ .5 ≡ 2/4.
function checkFraction(norm, answer) {
  const g = parseRational(norm);
  const w = parseRational(answer);
  if (g && w) return g.n * w.d === w.n * g.d;
  return checkNumeric(norm, answer); // fallback
}

// Parse "(x, y)", "x,y", "(-2,4)" → {x, y} integers.
function parseCoord(s) {
  const m = normalizeFib(s).match(/^\(?\s*([-+]?\d+)\s*,\s*([-+]?\d+)\s*\)?$/);
  if (!m) return null;
  return { x: parseInt(m[1], 10), y: parseInt(m[2], 10) };
}

// Coordinate equality is ORDER-SENSITIVE: (-2,4) ≠ (4,-2).
function checkCoordinate(norm, answer) {
  const g = parseCoord(norm);
  const w = parseCoord(answer);
  if (!g || !w) return false;
  return g.x === w.x && g.y === w.y;
}
