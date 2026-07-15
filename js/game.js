// game.js — the world: one canvas, one requestAnimationFrame loop.
// Sanaya's design: an endless climb (like Slope), a smiley circle dodging
// neon obstacles, speed rising forever so collisions — and math — become
// inevitable. The math RULES live in rules.js; answer CHECKING in validate.js;
// this file only moves things and detects hits.

import { newRun, applyCollision, applyAnswer, STREAK_TARGET } from "./rules.js";
import { checkAnswer } from "./validate.js";

// The dials. Everything about how the game FEELS is tuned here, in one place.
export const TUNING = {
  scrollStart: 175,   // how fast the world moves at the start (px/second)
  scrollRamp: 4.0,    // +px/s for every second you survive — "it keeps getting harder"
  scrollMax: 580,     // the ceiling (still far beyond comfortable dodging)
  spawnStart: 1.2,    // seconds between obstacle rows at the start
  spawnMin: 0.45,     // ...shrinking to this as you climb
  spawnRampT: 150,    // seconds it takes to reach the fastest spawn rate
  playerAccel: 2700,  // steering acceleration (px/s²)
  playerFriction: 8,  // how quickly the circle stops when you let go
  playerMaxV: 640,    // steering speed cap (px/s)
  ballR: 17,          // circle radius
  grace: 1.4,         // seconds of safety after a question (no instant re-hit)
};

const NEONS = ["#00e5ff", "#ff2d95", "#ffd400", "#b56bff", "#39ff14"];

export function createGame({ canvas, hooks }) {
  // hooks: { onCollision(q), onHud(run, meters), onGameOver(run, meters), pickQuestion() }
  const ctx = canvas.getContext("2d");

  let state = "idle"; // idle | running | question | paused | gameover
  let run = newRun();
  let gameTime = 0;     // seconds of actual play — does NOT advance in menus/modals
  let distance = 0;     // px climbed → shown as meters
  let graceLeft = 0;    // invulnerability countdown after a modal
  let shake = 0;        // camera shake after a hit

  let W = 0, H = 0, dpr = 1;
  const ball = { x: 0, vx: 0 };
  let obstacles = [];   // {x, y, w, h, color}
  let stars = [];       // parallax background
  let spawnClock = 0;
  let keys = { left: false, right: false };
  let circleColor = "#39ff14";
  let dizzyLeft = 0;    // little cross-eyed moment right after a hit

  // ---- sizing (crisp on retina; clamp DPR so old laptops don't melt) ----
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ball.x = Math.min(Math.max(ball.x, TUNING.ballR), W - TUNING.ballR);
    // seed stars only once the canvas has a real size — the game screen is
    // display:none at boot, and seeding into a 0×0 rect would pin every star
    // to the left edge forever
    if (stars.length === 0 && W > 0 && H > 0) seedStars();
  }
  window.addEventListener("resize", resize);

  function seedStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, depth: 0.15 + Math.random() * 0.5, r: 0.6 + Math.random() * 1.4 });
    }
  }

  // ---- speed ramp: this is what makes collisions (and math) inevitable ----
  function scrollSpeed() {
    return Math.min(TUNING.scrollStart + TUNING.scrollRamp * gameTime, TUNING.scrollMax);
  }
  function spawnInterval() {
    const t = Math.min(gameTime / TUNING.spawnRampT, 1);
    return TUNING.spawnStart + (TUNING.spawnMin - TUNING.spawnStart) * t;
  }

  // ---- obstacles ----
  function spawnRow() {
    const color = NEONS[Math.floor(Math.random() * NEONS.length)];
    const h = 22 + Math.random() * 14;
    const y = -h - 10;
    // difficulty tier: early = single blocks; later = rows with a gap to thread
    const tier = gameTime < 25 ? 0 : gameTime < 70 ? 1 : 2;
    const minGap = TUNING.ballR * 2 * 1.9; // always technically passable — fair, not rigged

    if (tier === 0 || (tier === 1 && Math.random() < 0.5)) {
      const w = 70 + Math.random() * 120;
      obstacles.push({ x: Math.random() * (W - w), y, w, h, color });
    } else {
      // a wall with one gap the player must steer through
      const gap = minGap + Math.random() * (tier === 1 ? 130 : 70);
      const gapX = TUNING.ballR + Math.random() * (W - gap - TUNING.ballR * 2);
      if (gapX > 4) obstacles.push({ x: 0, y, w: gapX, h, color });
      if (gapX + gap < W - 4) obstacles.push({ x: gapX + gap, y, w: W - gapX - gap, h, color });
    }
  }

  // circle-vs-rectangle: find the rect's closest point to the circle's centre,
  // then compare that distance to the radius. The standard, Googleable way.
  function hits(ball, yBall, o) {
    const cx = Math.max(o.x, Math.min(ball.x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(yBall, o.y + o.h));
    const dx = ball.x - cx, dy = yBall - cy;
    return dx * dx + dy * dy <= TUNING.ballR * TUNING.ballR;
  }

  // ---- the loop ----
  let last = performance.now();
  function frame(now) {
    // clamp dt so a backgrounded tab doesn't fast-forward the world on return
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === "running") update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    gameTime += dt;
    if (graceLeft > 0) graceLeft -= dt;
    if (dizzyLeft > 0) dizzyLeft -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 3);

    // steer: keys accelerate the ball; friction slows it back down.
    // Friction is strong when no key is held (so the ball stops quickly) and
    // gentle while steering (so it doesn't fight the player).
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    ball.vx += dir * TUNING.playerAccel * dt;
    const frictionShare = Math.min(TUNING.playerFriction * dt, 1); // fraction of speed lost this frame
    const brakingStrength = dir === 0 ? 1 : 0.25;
    ball.vx -= ball.vx * frictionShare * brakingStrength;
    ball.vx = Math.max(-TUNING.playerMaxV, Math.min(TUNING.playerMaxV, ball.vx));
    ball.x += ball.vx * dt;
    if (ball.x < TUNING.ballR) { ball.x = TUNING.ballR; ball.vx = 0; }
    if (ball.x > W - TUNING.ballR) { ball.x = W - TUNING.ballR; ball.vx = 0; }

    // climb
    const v = scrollSpeed();
    distance += v * dt;
    for (const o of obstacles) o.y += v * dt;
    obstacles = obstacles.filter((o) => o.y < H + 60);

    // spawn on GAME time, so pausing (modal, Esc, tab-blur) freezes spawning too
    spawnClock += dt;
    if (spawnClock >= spawnInterval()) {
      spawnClock = 0;
      spawnRow();
    }

    // collide
    const yBall = H * 0.72;
    if (graceLeft <= 0) {
      for (const o of obstacles) {
        if (hits(ball, yBall, o)) {
          applyCollision(run);
          shake = 1;
          dizzyLeft = 0.9;
          state = "question";
          hooks.onHud(run, meters());
          hooks.onCollision(hooks.pickQuestion());
          return;
        }
      }
    }
    hooks.onHud(run, meters());
  }

  function meters() { return Math.floor(distance / 10); }

  // ---- drawing ----
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // parallax stars drift DOWN as you climb up
    ctx.fillStyle = "#ffffff";
    for (const s of stars) {
      const y = (s.y + distance * s.depth) % H;
      ctx.globalAlpha = 0.25 + s.depth * 0.9;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const sx = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // neon obstacles (glow via shadowBlur)
    for (const o of obstacles) {
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = o.color;
      roundRect(ctx, o.x, o.y, o.w, o.h, 6);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    drawBall(H * 0.72);
    ctx.restore();
  }

  function drawBall(yBall) {
    const r = TUNING.ballR;
    const blink = graceLeft > 0 && Math.floor(graceLeft * 10) % 2 === 0; // safety blink
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.shadowColor = circleColor;
    ctx.shadowBlur = 22;
    ctx.fillStyle = circleColor;
    ctx.beginPath();
    ctx.arc(ball.x, yBall, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // the face — cross-eyed for a moment after a hit (her design)
    ctx.strokeStyle = "#0b0f1e";
    ctx.fillStyle = "#0b0f1e";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    const ex = r * 0.42, ey = yBall - r * 0.22, er = r * 0.16;
    if (dizzyLeft > 0) {
      for (const side of [-1, 1]) {
        const cx = ball.x + side * ex;
        ctx.beginPath();
        ctx.moveTo(cx - er * 1.4, ey - er * 1.4); ctx.lineTo(cx + er * 1.4, ey + er * 1.4);
        ctx.moveTo(cx + er * 1.4, ey - er * 1.4); ctx.lineTo(cx - er * 1.4, ey + er * 1.4);
        ctx.stroke();
      }
      ctx.beginPath(); // worried little mouth
      ctx.arc(ball.x, yBall + r * 0.5, r * 0.3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(ball.x + side * ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath(); // the smile
      ctx.arc(ball.x, yBall + r * 0.12, r * 0.52, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  // ---- public API (what ui.js/main.js drive) ----
  const api = {
    start() {
      run = newRun();
      gameTime = 0; distance = 0; spawnClock = 0; graceLeft = 0; shake = 0; dizzyLeft = 0;
      obstacles = [];
      ball.x = W / 2; ball.vx = 0;
      state = "running";
      hooks.onHud(run, 0);
    },
    // ui.js calls this with the player's raw answer; the game grades it with
    // the same checkAnswer the Node tests exercise, applies the rule, and
    // reports back what happened so the modal can show the right feedback.
    answer(raw, q) {
      const correct = checkAnswer(raw, q);
      const before = run.stats.bonusLives;
      applyAnswer(run, correct);
      hooks.onHud(run, meters());
      return { correct, over: run.over, earnedBonus: run.stats.bonusLives > before, run };
    },
    resume() { // after the modal closes (and the player survived)
      if (run.over) {
        state = "gameover";
        hooks.onGameOver(run, meters());
        return;
      }
      graceLeft = TUNING.grace;
      // clear anything about to land on the respawn spot — fair restart.
      // The cleared zone covers everything that would reach the ball DURING
      // the grace window at the current speed, so recovery is fair even when
      // the ramp is high.
      const yBall = H * 0.72;
      const reach = Math.max(200, scrollSpeed() * TUNING.grace);
      obstacles = obstacles.filter((o) => !(o.y + o.h > yBall - reach && o.y < yBall + 60));
      state = "running";
    },
    pause() { if (state === "running") state = "paused"; },
    unpause() { if (state === "paused") state = "running"; },
    stop() { state = "idle"; },
    setKeys(k) { keys = { ...keys, ...k }; },
    setCircleColor(c) { circleColor = c; },
    getState: () => state,
    getRun: () => run,
    meters,
    resize,
  };

  // debug hooks for verification only (?debug=1) — lets a test fast-forward
  // the ramp and prove collisions become inevitable without playing for 10 min
  if (new URLSearchParams(location.search).has("debug")) {
    window.__mc = {
      api, TUNING,
      get gameTime() { return gameTime; },
      set gameTime(v) { gameTime = v; },
      get distance() { return distance; },
      get obstacles() { return obstacles; },
      get run() { return run; },
      scrollSpeed, spawnInterval,
      // deterministic fixed-step driver, so checks don't depend on rAF timing
      step(seconds) {
        const n = Math.round(seconds / 0.016);
        for (let i = 0; i < n && state === "running"; i++) update(0.016);
        draw();
        return { state, gameTime, distance, obstacles: obstacles.length };
      },
    };
  }

  resize();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  return api;
}
