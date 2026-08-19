// audio.js — all sound, with no downloaded files at all.
// Sound effects AND the background music are SYNTHESIZED with the Web Audio
// API — oscillators and envelopes, so the repo stays zero-asset, there is
// nothing to license, and every sound is inspectable code. The music itself
// lives in music.js; this file owns the audio context and the volumes.
//
// Browser rule: audio may only start inside a user gesture (a click/keydown),
// so unlock() is called from the level-select click that starts the game.

import { createMusicEngine, DEFAULT_TRACK } from "./music.js";

let ctx = null;
let sfxGain = null;
let engine = null;
let settings = { musicOn: true, musicVolume: 0.6, sfxVolume: 0.8, musicTrack: DEFAULT_TRACK };

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = settings.sfxVolume;
    sfxGain.connect(ctx.destination);
    engine = createMusicEngine({ ctx, destination: ctx.destination });
    engine.setVolume(settings.musicVolume);
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
  if (!engine) return;
  engine.setVolume(settings.musicVolume);
  if (!settings.musicOn) engine.stop();
  else if (ctx && ctx.state === "running") startMusic();
}

// Auditioning a track from the settings screen: that click is itself the
// browser's audio gesture, so it can start straight away.
export function previewTrack(id) {
  if (!ensureCtx()) return;
  settings = { ...settings, musicTrack: id };
  if (settings.musicOn) engine.play(id);
}

export function startMusic() {
  if (!ensureCtx() || !engine) return;
  engine.play(settings.musicTrack);
}

export function stopMusic() { if (engine) engine.stop(); }

// Start the music only if the browser has already let audio through (i.e. the
// player has clicked something). Safe to call from anywhere — before the first
// gesture it does nothing rather than throwing or silently failing.
export function resumeIfUnlocked() {
  if (ctx && engine && settings.musicOn) startMusic();
}

// Drop the music back while a question is on screen — it should not compete
// with a player trying to do the maths.
export function duckMusic(on) { if (engine) engine.duck(on); }

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
