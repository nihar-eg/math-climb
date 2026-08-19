// music.js — the background music, generated in code.
//
// Sanaya asked for background music ("i want background music", Session 4).
// Rather than ship a downloaded file, the music is SYNTHESIZED the same way the
// sound effects already are — oscillators and envelopes, no assets. That means:
//   · nothing to license, credit, or worry about later on a public page
//   · it loops perfectly, because there is no file to have a gap at the seam
//   · it adds zero bytes to the page (a music file would be ~1MB)
//   · every note is inspectable code she can explain
//
// HOW IT WORKS (the short version, for the walkthrough):
//   A track is a chord progression plus a few patterns written as strings, like
//   an old tracker. "x-x-x-x-" means "play on step 1, rest on step 2, play on
//   step 3…". Sixteen steps make a bar. A scheduler wakes up every 25ms, looks a
//   fraction of a second into the future, and books any notes due in that window
//   with the Web Audio clock — which is sample-accurate, unlike setInterval, so
//   the rhythm never drifts.
//
//   Tracks are LONG on purpose: the chord progression and the section list have
//   different lengths, so the combination doesn't repeat for minutes rather than
//   for a few bars. Each track prints its own cycle length via cycleSeconds().

const STEPS_PER_BAR = 16;         // sixteenth notes
const LOOKAHEAD_MS = 25;          // how often the scheduler wakes up
const SCHEDULE_AHEAD_S = 0.18;    // how far ahead it books notes

// midi note number → frequency. 69 is A4 = 440Hz.
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Chords as semitone offsets from their root note.
const CHORD = {
  min:    [0, 3, 7],
  maj:    [0, 4, 7],
  min7:   [0, 3, 7, 10],
  maj7:   [0, 4, 7, 11],
  dom7:   [0, 4, 7, 10],
  sus2:   [0, 2, 7],
  six:    [0, 4, 7, 9],
};

// Swing = the off-beat EIGHTH of each beat lands late. With four 16th-steps to
// a beat those are steps 2, 6, 10, 14 — i.e. step % 4 === 2. (An earlier version
// delayed every odd 16th instead, which sounds correct on paper but did nothing
// here: the hat pattern only lands on even steps, so nothing actually moved.
// Measured in the browser, the gaps came out perfectly uniform.)
export function swingOffset(step, swing, stepDur) {
  if (!swing) return 0;
  return step % 4 === 2 ? swing * stepDur : 0;
}

// A pattern string: "x" plays, "-" rests, digits pick a velocity 1-9.
function hit(pattern, step) {
  const c = pattern[step % pattern.length];
  if (c === "-" || c === undefined) return 0;
  if (c === "x") return 1;
  const n = Number(c);
  return Number.isFinite(n) ? n / 9 : 0;
}

// ---------------------------------------------------------------- the tracks
//
// root: midi note of the chord's root.  bars: how long the chord lasts.
// Optional per track: `swing` (0-0.3, delays every other 16th) and `padDetune`
// (cents for a warm second pad voice). Both default to off.
// Sections switch layers on and off so the piece moves through quiet and busy
// stretches instead of hammering the same texture forever.

export const TRACKS = Object.freeze({
  neonDrive: {
    id: "neonDrive",
    label: "Neon Drive",
    blurb: "Steady and driving. Pairs with the Neon and Pastel Dusk looks.",
    bpm: 112,
    progression: [
      { root: 57, chord: "min",  bars: 2 },  // Am
      { root: 53, chord: "maj",  bars: 2 },  // F
      { root: 48, chord: "maj",  bars: 2 },  // C
      { root: 55, chord: "maj",  bars: 2 },  // G
      { root: 57, chord: "min",  bars: 2 },  // Am
      { root: 53, chord: "maj",  bars: 2 },  // F
      { root: 50, chord: "min7", bars: 2 },  // Dm7
      { root: 52, chord: "dom7", bars: 2 },  // E7  → pulls back to Am
    ],
    patterns: {
      bass: "x---x---x---x-x-",
      arp:  "x-x-x-x-x-x-x-x-",
      kick: "x-------x-------",
      hat:  "--x---x---x---x-",
    },
    arpShape: [0, 1, 2, 3, 2, 1],      // walks up and back down the chord
    sections: [
      { bars: 8,  layers: ["pad", "bass"] },
      { bars: 8,  layers: ["pad", "bass", "arp"] },
      { bars: 16, layers: ["pad", "bass", "arp", "kick", "hat"] },
      { bars: 8,  layers: ["pad", "arp"] },
      { bars: 16, layers: ["pad", "bass", "arp", "kick", "hat"] },
    ],
    voices: { pad: "sawtooth", bass: "triangle", arp: "square" },
    gain: 0.85,
  },

  softFocus: {
    id: "softFocus",
    label: "Soft Focus",
    blurb: "Calm, no drums. The least distracting while you're doing the maths.",
    bpm: 72,
    progression: [
      { root: 48, chord: "maj7", bars: 4 },  // Cmaj7
      { root: 45, chord: "min7", bars: 4 },  // Am7
      { root: 53, chord: "maj7", bars: 4 },  // Fmaj7
      { root: 55, chord: "six",  bars: 4 },  // G6
      { root: 50, chord: "min7", bars: 4 },  // Dm7
      { root: 55, chord: "sus2", bars: 4 },  // Gsus2
    ],
    patterns: {
      bass: "x---------------",
      arp:  "x-----x---x-----",
      kick: "----------------",
      hat:  "----------------",
    },
    arpShape: [0, 2, 1, 3],
    sections: [
      { bars: 8,  layers: ["pad"] },
      { bars: 12, layers: ["pad", "arp"] },
      { bars: 12, layers: ["pad", "arp", "bass"] },
      { bars: 8,  layers: ["pad", "arp"] },
    ],
    voices: { pad: "sine", bass: "sine", arp: "triangle" },
    gain: 1.0,
  },

  arcade: {
    id: "arcade",
    label: "Arcade",
    blurb: "Bright and chiptune. The most 'game' of the four.",
    bpm: 132,
    progression: [
      { root: 48, chord: "maj",  bars: 1 },  // C
      { root: 55, chord: "maj",  bars: 1 },  // G
      { root: 57, chord: "min",  bars: 1 },  // Am
      { root: 53, chord: "maj",  bars: 1 },  // F
      { root: 48, chord: "maj",  bars: 1 },  // C
      { root: 53, chord: "maj",  bars: 1 },  // F
      { root: 55, chord: "dom7", bars: 1 },  // G7
      { root: 48, chord: "maj",  bars: 1 },  // C
      { root: 50, chord: "min",  bars: 1 },  // Dm
      { root: 55, chord: "maj",  bars: 1 },  // G
      { root: 57, chord: "min",  bars: 1 },  // Am
      { root: 52, chord: "min",  bars: 1 },  // Em
    ],
    patterns: {
      bass: "x-x-x-x-x-x-x-x-",
      arp:  "xxxxxxxxxxxxxxxx",
      kick: "x-------x---x---",
      hat:  "--x---x---x---x-",
    },
    arpShape: [0, 1, 2, 3, 4, 3, 2, 1],
    sections: [
      { bars: 8,  layers: ["bass", "arp"] },
      { bars: 12, layers: ["bass", "arp", "kick", "hat"] },
      { bars: 8,  layers: ["pad", "arp"] },
      { bars: 16, layers: ["pad", "bass", "arp", "kick", "hat"] },
    ],
    voices: { pad: "square", bass: "square", arp: "square" },
    gain: 0.7,
  },

  // Replaces an earlier "Night Climb", which was too close to Soft Focus — same
  // sine pad, same no-drums, same sparse bass on beat one, same section shape.
  // Two quiet tracks that differ only in key and tempo are one track. This one
  // is built to differ in FEEL: it swings, so it sits off the strict grid every
  // other track sits on, and it is the only one with a syncopated kick.
  //
  // Lo-fi is also the genre kids actually put on to do homework to, which for a
  // maths practice game is the point rather than a coincidence.
  studyHall: {
    id: "studyHall",
    label: "Study Hall",
    blurb: "Slow, swung lo-fi. The one to put on while you actually work.",
    bpm: 78,
    swing: 0.18,          // delays every other 16th — nothing else here swings
    padDetune: 7,         // a second pad voice, 7 cents off, for warmth
    progression: [
      { root: 53, chord: "maj7", bars: 3 },  // Fmaj7
      { root: 50, chord: "min7", bars: 3 },  // Dm7
      { root: 46, chord: "maj7", bars: 3 },  // Bbmaj7
      { root: 48, chord: "dom7", bars: 3 },  // C7
      { root: 57, chord: "min7", bars: 3 },  // Am7
      { root: 55, chord: "min7", bars: 3 },  // Gm7
      { root: 46, chord: "maj7", bars: 3 },  // Bbmaj7
      { root: 48, chord: "dom7", bars: 3 },  // C7  → back round to F
    ],
    patterns: {
      bass: "x-------x---x---",
      arp:  "----x-------x--x",
      kick: "x-----x---x-----",   // syncopated, not four-on-the-floor
      hat:  "--x-x-x---x-x-x-",   // swung by the engine
    },
    arpShape: [2, 3, 1, 4],
    sections: [
      { bars: 8,  layers: ["pad"] },
      { bars: 12, layers: ["pad", "bass", "hat"] },
      { bars: 16, layers: ["pad", "bass", "arp", "kick", "hat"] },
      { bars: 8,  layers: ["pad", "arp"] },
    ],
    voices: { pad: "triangle", bass: "sine", arp: "sine" },
    gain: 0.9,
  },
});

export const TRACK_IDS = Object.freeze(Object.keys(TRACKS));
// Nihar's pick. It has drums, which play under someone doing algebra — the
// music ducks to 28% whenever a question is on screen, which is what makes that
// acceptable. Soft Focus and Study Hall stay one click away for anyone who
// wants quiet.
export const DEFAULT_TRACK = "neonDrive";

export function isTrackId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(TRACKS, id);
}
export function getTrack(id) {
  return isTrackId(id) ? TRACKS[id] : TRACKS[DEFAULT_TRACK];
}

// How long before a track repeats itself EXACTLY. The chord progression and the
// section list are deliberately different lengths, so the piece only comes back
// around when both line up — which is where the length comes from.
export function cycleSeconds(id) {
  const t = getTrack(id);
  const progBars = t.progression.reduce((n, c) => n + c.bars, 0);
  const sectBars = t.sections.reduce((n, s) => n + s.bars, 0);
  const lcm = (a, b) => (a * b) / gcd(a, b);
  const bars = lcm(progBars, sectBars);
  return (bars * 4 * 60) / t.bpm;     // 4 beats per bar
}
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

// Which chord is sounding on a given bar, and which section we're in.
export function chordAtBar(track, bar) {
  const total = track.progression.reduce((n, c) => n + c.bars, 0);
  let b = ((bar % total) + total) % total;
  for (const c of track.progression) {
    if (b < c.bars) return c;
    b -= c.bars;
  }
  return track.progression[0];
}
export function sectionAtBar(track, bar) {
  const total = track.sections.reduce((n, s) => n + s.bars, 0);
  let b = ((bar % total) + total) % total;
  for (const s of track.sections) {
    if (b < s.bars) return s;
    b -= s.bars;
  }
  return track.sections[0];
}

// ------------------------------------------------------------- the player
export function createMusicEngine({ ctx, destination }) {
  const master = ctx.createGain();
  master.gain.value = 0;
  // one gentle lowpass over everything so square waves don't get shrill
  const tame = ctx.createBiquadFilter();
  tame.type = "lowpass";
  tame.frequency.value = 4200;
  master.connect(tame);
  tame.connect(destination);

  // reusable white noise for the hats — built once, not per hit
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  let track = null;
  let timer = null;
  let step = 0;          // 16th-note counter since the track started
  let nextTime = 0;      // audio-clock time of the next step
  let volume = 0.6;
  let ducked = false;

  function note({ freq, at, dur, type = "sine", peak = 0.2, attack = 0.01 }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  function hatAt(at, peak) {
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000;
    src.buffer = noise;
    g.gain.setValueAtTime(peak * 0.16, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(at);
    src.stop(at + 0.08);
  }

  function kickAt(at, peak) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    g.gain.setValueAtTime(peak * 0.5, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    o.connect(g); g.connect(master);
    o.start(at);
    o.stop(at + 0.25);
  }

  // Book everything that falls on one 16th-note step.
  function scheduleStep(i, at) {
    const bar = Math.floor(i / STEPS_PER_BAR);
    const inBar = i % STEPS_PER_BAR;
    const chord = chordAtBar(track, bar);
    const section = sectionAtBar(track, bar);
    const on = (layer) => section.layers.includes(layer);
    const tones = CHORD[chord.chord] || CHORD.min;
    const beat = (60 / track.bpm);
    const stepDur = beat / 4;

    // pad — one long chord, re-struck at the top of each bar it belongs to
    if (on("pad") && inBar === 0) {
      const detune = track.padDetune || 0;   // cents; 0 = a single clean voice
      for (const semi of tones) {
        const f = hz(chord.root + semi + 12);
        note({ freq: f, at, dur: beat * 3.6, type: track.voices.pad, peak: 0.045, attack: 0.35 });
        if (detune) {
          // a second voice slightly out of tune beats against the first — the
          // slow shimmer that makes a pad sound warm instead of sterile
          note({ freq: f * Math.pow(2, detune / 1200), at, dur: beat * 3.6,
                 type: track.voices.pad, peak: 0.032, attack: 0.4 });
        }
      }
    }
    // bass — root, with the fifth on the offbeats for movement
    if (on("bass")) {
      const v = hit(track.patterns.bass, i);
      if (v) {
        const semi = inBar % 8 === 0 ? 0 : (inBar % 4 === 0 ? 7 : 0);
        note({ freq: hz(chord.root + semi - 12), at, dur: stepDur * 3,
               type: track.voices.bass, peak: 0.16 * v, attack: 0.006 });
      }
    }
    // arp — walks the chord tones in the shape the track defines
    if (on("arp")) {
      const v = hit(track.patterns.arp, i);
      if (v) {
        const shape = track.arpShape;
        const pick = shape[i % shape.length];
        const semi = tones[pick % tones.length] + 12 * Math.floor(pick / tones.length);
        note({ freq: hz(chord.root + semi + 12), at, dur: stepDur * 1.8,
               type: track.voices.arp, peak: 0.07 * v, attack: 0.005 });
      }
    }
    if (on("kick")) { const v = hit(track.patterns.kick, i); if (v) kickAt(at, v); }
    if (on("hat"))  { const v = hit(track.patterns.hat, i);  if (v) hatAt(at, v); }
  }

  // The scheduler: look a little way into the future and book what's due. The
  // audio clock does the timing, not setInterval — which is why it never drifts.
  function tick() {
    const stepDur = (60 / track.bpm) / 4;
    const swing = track.swing || 0;
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      // The GRID doesn't move — only the note's play time — so the bar never
      // drifts out of time no matter how long it plays.
      const nudge = swingOffset(step, swing, stepDur);
      scheduleStep(step, nextTime + nudge);
      step += 1;
      nextTime += stepDur;
    }
  }

  function applyGain() {
    const target = volume * (track ? track.gain : 1) * (ducked ? 0.28 : 1);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  }

  return {
    play(id) {
      const next = getTrack(id);
      if (track && track.id === next.id && timer) return;   // already playing it
      this.stop();
      track = next;
      step = 0;
      nextTime = ctx.currentTime + 0.08;
      applyGain();
      tick();
      timer = setInterval(tick, LOOKAHEAD_MS);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    isPlaying() { return timer !== null; },
    currentTrack() { return track ? track.id : null; },
    setVolume(v) { volume = Math.min(1, Math.max(0, Number(v) || 0)); applyGain(); },
    // pull the music down while a question is on screen, so it doesn't compete
    // with someone trying to do maths, then bring it back
    duck(on) { ducked = !!on; applyGain(); },
  };
}
