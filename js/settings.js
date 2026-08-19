// settings.js — player settings (theme, circle colour, music, volumes, and
// whether they've seen the how-to-play card yet).
// Storage is INJECTED (defaults to localStorage in the browser) so it tests in
// Node with a fake. Login-free: everything lives per-browser in localStorage.

import { DEFAULT_THEME, getTheme, isThemeId } from "./themes.js";

export const DEFAULTS = Object.freeze({
  theme: DEFAULT_THEME,
  circleColor: getTheme(DEFAULT_THEME).defaultCircle,
  // false = "I never picked a colour, just follow the theme"; flips to true the
  // moment the player taps a swatch or the colour picker, so switching themes
  // afterwards never clobbers a deliberate choice.
  circleCustom: false,
  musicOn: true,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  // The how-to-play card opens by itself on a first visit — Sanaya's review
  // note was that it took a few tries to work out how the game works.
  seenHowTo: false,
});

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
    if (isThemeId(s.theme)) out.theme = s.theme;
    if (typeof s.circleColor === "string" && HEX6.test(s.circleColor)) out.circleColor = s.circleColor;
    if (typeof s.circleCustom === "boolean") out.circleCustom = s.circleCustom;
    if (typeof s.musicOn === "boolean") out.musicOn = s.musicOn;
    if (typeof s.seenHowTo === "boolean") out.seenHowTo = s.seenHowTo;
    const mv = clampVolume(s.musicVolume); if (mv !== undefined) out.musicVolume = mv;
    const sv = clampVolume(s.sfxVolume); if (sv !== undefined) out.sfxVolume = sv;
  }
  return out;
}

// Which circle colour a theme switch should land on. Kept separate from
// sanitize() on purpose: sanitize's one job is to validate what's on disk, so
// it must never quietly rewrite a colour that was saved deliberately.
export function circleColorForTheme(settings, themeId) {
  return settings.circleCustom ? settings.circleColor : getTheme(themeId).defaultCircle;
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

// A save written before themes existed carries a circleColor chosen for the old
// neon skin (usually #39ff14) and no way to know whether the player picked it.
// Sanaya reviewed that build, so her own browser holds exactly this — without
// migration, "the pastel version" would open with a neon-lime circle.
export function migrateLegacy(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const preThemeSave = !("theme" in parsed) && !("circleCustom" in parsed);
  if (!preThemeSave) return parsed;
  const { circleColor, ...rest } = parsed;   // drop it; the new theme decides
  return rest;
}

export function loadSettings(storage = defaultStorage()) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return sanitize(migrateLegacy(JSON.parse(raw)));
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
