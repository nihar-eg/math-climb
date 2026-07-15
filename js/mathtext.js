// mathtext.js — display-layer math formatting. Pure string functions (no DOM)
// so they're unit-testable; ui.js decides where the output goes.
//
// Why this exists: bank prompts use the convention
//     "x − 4 = 12.   x = ?"    (problem, period, THREE spaces, ask)
// HTML collapses the spaces, so it rendered as "x − 4 = 12. x = ?" — and the
// period right before x reads like a multiplication dot ("12·x"). The data
// stays as authored (Sanaya's rows are frozen); the fix is how we SHOW it.

// Split a prompt into the problem and the ask. Only a period followed by
// TWO OR MORE spaces is a separator — normal sentences ("Start at (2, 3). Go
// left 4…") have single spaces and must never be split.
export function splitPrompt(prompt) {
  const m = String(prompt).match(/^(.*?)\.\s{2,}(.*)$/s);
  if (m) return { problem: m[1].trim(), ask: m[2].trim() };
  return { problem: String(prompt).trim(), ask: "" };
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Turn caret notation into real superscripts for display: "2^4" → 2⁴,
// "5^(8−2)" → 5^(8−2) as a superscript group, "(2^3)^2" → the outer exponent
// sits on the closing bracket. Escapes HTML first — the output is meant for
// innerHTML.
export function toMathHtml(s) {
  return escapeHtml(s)
    .replace(/(\w)\^\(([^)]+)\)/g, "$1<sup>$2</sup>")
    .replace(/(\w)\^([\w.\-−]+)/g, "$1<sup>$2</sup>")
    .replace(/\)\^\(([^)]+)\)/g, ")<sup>$1</sup>")
    .replace(/\)\^([\w.\-−]+)/g, ")<sup>$1</sup>");
}
