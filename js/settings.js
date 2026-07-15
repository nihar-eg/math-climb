// settings.js — player settings (circle colour, music, volumes).
// Storage is INJECTED (defaults to localStorage in the browser) so it tests in
// Node with a fake. Login-free: everything lives per-browser in localStorage.

export const DEFAULTS = Object.freeze({
  circleColor: "#39ff14", // neon green
  musicOn: true,
  musicVolume: 0.6,
  sfxVolume: 0.8,
});

// Preset neon swatches for the settings screen (a native colour picker can be
// offered alongside these at Stage 4).
export const SWATCHES = Object.freeze([
  "#39ff14", "#ff2d95", "#00e5ff", "#ffd400", "#b56bff", "#ffffff",
]);

const KEY = "mathslope.settings";
const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Clamp a volume to [0, 1]. Accepts a number (from JSON) or a numeric string
// (from a browser range-slider); rejects null / boolean / array / "" so a
// tampered or corrupt save falls back to the default instead of muting/maxing.
export function clampVolume(v) {
  if (typeof v !== "number" && typeof v !== "string") return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

// Coerce any (possibly tampered) object into a valid settings object, keeping
// only well-formed fields and defaulting the rest.
export function sanitize(s) {
  const out = { ...DEFAULTS };
  if (s && typeof s === "object") {
    if (typeof s.circleColor === "string" && HEX6.test(s.circleColor)) out.circleColor = s.circleColor;
    if (typeof s.musicOn === "boolean") out.musicOn = s.musicOn;
    const mv = clampVolume(s.musicVolume); if (mv !== undefined) out.musicVolume = mv;
    const sv = clampVolume(s.sfxVolume); if (sv !== undefined) out.sfxVolume = sv;
  }
  return out;
}

// Even READING globalThis.localStorage throws in browsers set to block all
// cookies/storage (common on school laptops) — so the default itself must be
// guarded, not just the calls. A default parameter runs before the function
// body's try/catch and would crash boot otherwise.
function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null; // storage blocked → play with defaults, don't crash
  }
}

export function loadSettings(storage = defaultStorage()) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULTS }; // corrupt JSON or no storage → safe defaults
  }
}

export function saveSettings(s, storage = defaultStorage()) {
  const clean = sanitize(s);
  try {
    storage && storage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable (private mode / quota) — game still runs */
  }
  return clean;
}
