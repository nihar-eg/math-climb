// audio.js — sound without any downloaded files (yet).
// Sound effects are SYNTHESIZED with the Web Audio API — tiny recipes of
// oscillators, so the repo stays zero-asset and every sound is inspectable
// code. Background music expects assets/music.mp3 (a royalty-free pick,
// pending); if the file isn't there, the game simply plays without music.
//
// Browser rule: audio may only start inside a user gesture (a click/keydown),
// so unlock() is called from the level-select click that starts the game.

let ctx = null;
let sfxGain = null;
let music = null;
let musicAvailable = null; // null = unknown, then true/false
let settings = { musicOn: true, musicVolume: 0.6, sfxVolume: 0.8 };

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = settings.sfxVolume;
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlock() {
  ensureCtx();
  if (settings.musicOn) startMusic();
}

export function applySettings(s) {
  settings = { ...settings, ...s };
  if (sfxGain) sfxGain.gain.value = settings.sfxVolume;
  if (music) music.volume = settings.musicVolume;
  if (music && !settings.musicOn) music.pause();
  if (settings.musicOn && musicAvailable) startMusic();
}

export function musicStatus() { return musicAvailable; }

function startMusic() {
  if (musicAvailable === false) return;
  if (!music) {
    music = new Audio("assets/music.mp3");
    music.loop = true;
    music.volume = settings.musicVolume;
    music.addEventListener("error", () => { musicAvailable = false; music = null; });
    music.addEventListener("canplay", () => { musicAvailable = true; });
  }
  music.play().catch(() => { /* not available or blocked — fine, SFX carry the game */ });
}

export function stopMusic() { if (music) music.pause(); }

// one synthesized note
function tone(freq, when, dur, type = "sine", peak = 0.5) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + when + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(ctx.currentTime + when);
  o.stop(ctx.currentTime + when + dur + 0.05);
}

const RECIPES = {
  correct()   { tone(660, 0, 0.12, "sine", 0.5); tone(880, 0.1, 0.18, "sine", 0.5); },
  wrong()     { tone(180, 0, 0.28, "square", 0.25); tone(130, 0.08, 0.3, "square", 0.2); },
  collision() { tone(300, 0, 0.08, "sawtooth", 0.4); tone(90, 0.02, 0.25, "sine", 0.6); },
  extralife() { tone(523, 0, 0.1, "sine", 0.45); tone(659, 0.09, 0.1, "sine", 0.45); tone(784, 0.18, 0.12, "sine", 0.45); tone(1047, 0.28, 0.22, "sine", 0.5); },
  gameover()  { tone(440, 0, 0.22, "sine", 0.4); tone(330, 0.2, 0.22, "sine", 0.4); tone(220, 0.4, 0.5, "sine", 0.45); },
  click()     { tone(700, 0, 0.05, "sine", 0.18); },
};

export function sfx(name) {
  if (!ensureCtx()) return;
  const recipe = RECIPES[name];
  if (recipe) recipe();
}
