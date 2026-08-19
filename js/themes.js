// themes.js — the whole look of the game, as data.
//
// Sanaya asked for pastel colours (review, Aug 2026) and for a few variations
// to choose from. Rather than repaint one skin, every colour the game can show
// lives in a theme object here: the CSS tokens (screens, buttons, panels) AND
// the canvas colours (obstacles, the ink on the circle's face), which the
// stylesheet can't reach.
//
// Adding a theme = adding one entry to THEMES. Nothing else in the codebase
// needs to know it exists — the settings screen builds its picker from this list.
//
// A theme carries:
//   tokens          CSS custom properties written onto <html>
//   obstacles       canvas bar colours (game.js picks from these)
//   star            the drifting parallax specks behind the climb
//   obstacleStroke  outline for the bars, or null for none
//   glow            true  → neon bloom (reads on dark backgrounds)
//                   false → flat fill + outline (bloom is invisible on light)
//   defaultCircle   the player circle this theme starts with
//   swatches        circle colours offered on the settings screen
//
// NOTE — the game-over screen stays black-with-stars in every theme. That is
// Sanaya's own design decision from Session 3 and is deliberately NOT themed;
// see style.css `.starfield`, which re-lights its text so dark-on-light themes
// stay readable there.

export const THEMES = Object.freeze({
  // ---------------------------------------------------------------- pastels
  cottonCandy: {
    id: "cottonCandy",
    label: "Cotton Candy",
    dark: false,
    glow: false,
    tokens: {
      "--bg": "#f7f2fb",
      "--bg-deep": "#ece2f6",
      "--panel": "#ffffff",
      "--panel-edge": "#ddcdee",
      "--text": "#35283f",
      "--dim": "#665a78",
      "--ink": "#35283f",
      "--accent-a": "#c3226d",   // TEXT (the question kicker) — needs 4.5:1 on --panel, not just a pretty tint
      "--accent-b": "#5b93e0",
      "--accent-c": "#d9982f",
      "--accent-d": "#9b63e8",
      "--danger": "#d63a5c",
      "--good": "#158f63",
      "--warn": "#9a5b16",
    },
    obstacles: ["#f36bab", "#7aa9ee", "#f0b45c", "#a97ceb", "#5fc9b0"],
    star: "#cbb6de",          // soft, or the parallax reads as dust on a pale field
    obstacleStroke: "#35283f",   // opaque: the outline is what makes a soft bar visible
    defaultCircle: "#f36bab",
    swatches: ["#f36bab", "#7aa9ee", "#f0b45c", "#a97ceb", "#5fc9b0", "#bbaec2"],
  },

  seaGlass: {
    id: "seaGlass",
    label: "Sea Glass",
    dark: false,
    glow: false,
    tokens: {
      "--bg": "#f2faf7",
      "--bg-deep": "#e2f2ec",
      "--panel": "#ffffff",
      "--panel-edge": "#c8e3d8",
      "--text": "#1f352f",
      "--dim": "#4e6d64",
      "--ink": "#1f352f",
      "--accent-a": "#0e8175",   // TEXT (the question kicker) — needs 4.5:1 on --panel, not just a pretty tint
      "--accent-b": "#3f8fc9",
      "--accent-c": "#c98f1f",
      "--accent-d": "#7d63d6",
      "--danger": "#cf4a45",
      "--good": "#12876a",
      "--warn": "#8c5f10",
    },
    obstacles: ["#3fbfa3", "#61a9dd", "#e8b95c", "#9b86e6", "#ef8fb4"],
    star: "#a7cdc0",          // soft, or the parallax reads as dust on a pale field
    obstacleStroke: "#1f352f",   // opaque: the outline is what makes a soft bar visible
    defaultCircle: "#3fbfa3",
    swatches: ["#3fbfa3", "#61a9dd", "#e8b95c", "#9b86e6", "#ef8fb4", "#aec2bd"],
  },

  peachSherbet: {
    id: "peachSherbet",
    label: "Peach Sherbet",
    dark: false,
    glow: false,
    tokens: {
      "--bg": "#fff6f0",
      "--bg-deep": "#ffe8db",
      "--panel": "#ffffff",
      "--panel-edge": "#f2d3bf",
      "--text": "#40291f",
      "--dim": "#6f5041",
      "--ink": "#40291f",
      "--accent-a": "#cc3d19",   // TEXT (the question kicker) — needs 4.5:1 on --panel, not just a pretty tint
      "--accent-b": "#cf8a1e",
      "--accent-c": "#d9506f",
      "--accent-d": "#4a8cbf",
      "--danger": "#c93f42",
      "--good": "#1f8a5c",
      "--warn": "#96500f",
    },
    obstacles: ["#f5885d", "#f0b556", "#ea7592", "#6aa8d6", "#7cc074"],
    star: "#e8c2aa",          // soft, or the parallax reads as dust on a pale field
    obstacleStroke: "#40291f",   // opaque: the outline is what makes a soft bar visible
    defaultCircle: "#f5885d",
    swatches: ["#f5885d", "#f0b556", "#ea7592", "#6aa8d6", "#7cc074", "#c4b5ab"],
  },

  pastelDusk: {
    id: "pastelDusk",
    label: "Pastel Dusk",
    dark: true,
    glow: true,
    tokens: {
      "--bg": "#1e1b33",
      "--bg-deep": "#15132a",
      "--panel": "#2a2646",
      "--panel-edge": "#3f3970",
      "--text": "#f2eeff",
      "--dim": "#b3accf",
      "--ink": "#1e1b33",
      "--accent-a": "#ffb3d1",
      "--accent-b": "#a8d8ff",
      "--accent-c": "#ffe0a3",
      "--accent-d": "#c9b3ff",
      "--danger": "#ff8098",
      "--good": "#7df0c0",
      "--warn": "#ffd28a",
    },
    obstacles: ["#ffb3d1", "#a8d8ff", "#ffe0a3", "#c9b3ff", "#a8f0d8"],
    star: "#ffffff",
    obstacleStroke: null,
    defaultCircle: "#ffb3d1",
    swatches: ["#ffb3d1", "#a8d8ff", "#ffe0a3", "#c9b3ff", "#a8f0d8", "#ffffff"],
  },

  // ------------------------------------------------- the original neon look
  neon: {
    id: "neon",
    label: "Neon (original)",
    dark: true,
    glow: true,
    tokens: {
      "--bg": "#0b0f1e",
      "--bg-deep": "#060913",
      "--panel": "#141b33",
      "--panel-edge": "#26305a",
      "--text": "#eef2ff",
      "--dim": "#9aa5c5",
      "--ink": "#0b0f1e",
      "--accent-a": "#00e5ff",
      "--accent-b": "#ff2d95",
      "--accent-c": "#ffd400",
      "--accent-d": "#b56bff",
      "--danger": "#ff4d5e",
      "--good": "#39ff14",
      "--warn": "#ffd400",
    },
    obstacles: ["#00e5ff", "#ff2d95", "#ffd400", "#b56bff", "#39ff14"],
    star: "#ffffff",
    obstacleStroke: null,
    defaultCircle: "#39ff14",
    swatches: ["#39ff14", "#ff2d95", "#00e5ff", "#ffd400", "#b56bff", "#ffffff"],
  },
});

// Pastel is what she asked for, so the game opens pastel. Neon stays one click
// away in Settings.
export const DEFAULT_THEME = "cottonCandy";

export const THEME_IDS = Object.freeze(Object.keys(THEMES));

export function isThemeId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(THEMES, id);
}

// Never throws and never returns undefined — an unknown id (old save, typo,
// tampered localStorage) falls back to the default rather than breaking boot.
export function getTheme(id) {
  return isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME];
}

// Write a theme's tokens onto a root element (document.documentElement in the
// browser; any object with a .style.setProperty in a test).
export function applyTheme(root, id) {
  const theme = getTheme(id);
  for (const [prop, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(prop, value);
  }
  return theme;
}
