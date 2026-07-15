// ui.js — every screen, button, and the question modal. The game world lives
// in game.js; the rules in rules.js; this file only moves the player between
// screens and shows what the game reports.

import { getLevel, ShuffleBag } from "./bank.js";
import { SWATCHES, loadSettings, saveSettings } from "./settings.js";
import { STREAK_TARGET } from "./rules.js";
import { splitPrompt, toMathHtml } from "./mathtext.js";
import * as audio from "./audio.js";

const LEVEL_LABELS = { grade6: "6th grade", grade7: "7th grade", grade8: "8th grade" };
const TOPIC_ICONS = { algebra: "𝑥", exponents: "xⁿ", ratios: "⚖", coordinates: "⊹" };
const TOPIC_ACCENTS = { algebra: "var(--neon-cyan)", exponents: "var(--neon-pink)", ratios: "var(--neon-yellow)", coordinates: "var(--neon-purple)" };

const $ = (id) => document.getElementById(id);

export function initUI({ bank, game }) {
  let settings = loadSettings();
  let chosenTopic = null;
  let chosenLevel = null;
  let bag = null;
  let currentQ = null;

  applyCircleColor(settings.circleColor);
  audio.applySettings(settings);

  // ---------- screen switching ----------
  const screens = ["title", "topics", "levels", "settings", "game", "gameover"];
  function show(name) {
    for (const s of screens) $(`screen-${s}`).classList.toggle("active", s === name);
  }

  document.querySelectorAll("[data-back]").forEach((b) =>
    b.addEventListener("click", () => { audio.sfx("click"); show(b.dataset.back); })
  );

  // ---------- title ----------
  $("btn-play").addEventListener("click", () => { audio.sfx("click"); show("topics"); });
  $("btn-settings").addEventListener("click", () => { audio.sfx("click"); show("settings"); });
  if ("ontouchstart" in window && window.innerWidth < 900) $("mobile-notice").hidden = false;

  // ---------- topics (built from the question bank itself) ----------
  const grid = $("topic-grid");
  for (const [key, topic] of Object.entries(bank.topics)) {
    const btn = document.createElement("button");
    btn.className = "topic-card";
    btn.style.setProperty("--accent", TOPIC_ACCENTS[key] || "var(--neon-cyan)");
    const nQuestions = Object.values(topic.levels).reduce((n, rows) => n + rows.length, 0);
    btn.innerHTML = `<span class="topic-icon">${TOPIC_ICONS[key] || "∑"}</span>
      <span>${topic.label}</span>
      <span class="topic-count">${nQuestions} questions</span>`;
    btn.addEventListener("click", () => {
      audio.sfx("click");
      chosenTopic = key;
      $("levels-topic-name").textContent = topic.label;
      show("levels");
    });
    grid.appendChild(btn);
  }

  // ---------- levels ----------
  $("level-buttons").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-level");
    if (!btn) return;
    chosenLevel = btn.dataset.level;
    startGame(); // this click is also the browser's audio-unlock gesture
  });

  function startGame() {
    const rows = getLevel(bank, chosenTopic, chosenLevel);
    if (rows.length === 0) return; // bank validator would have warned at boot
    bag = new ShuffleBag(rows);
    $("hud-topic").textContent = `${bank.topics[chosenTopic].label} · ${LEVEL_LABELS[chosenLevel]}`;
    audio.unlock();
    show("game");
    game.resize();
    game.setCircleColor(settings.circleColor);
    game.start();
  }

  // ---------- HUD ----------
  function onHud(run, meters) {
    const lives = Math.max(run.lives, 0);
    $("hud-lives").innerHTML = lives <= 5 ? "&hearts;".repeat(lives) : `&hearts; ×${lives}`;
    // streak is always 0–4 here: rules.js resets it the moment it pays out
    const pips = $("hud-streak").querySelectorAll(".pip");
    pips.forEach((p, i) => p.classList.toggle("lit", i < run.streak));
    $("hud-distance").textContent = `${meters} m`;
  }

  // ---------- the recovery question ----------
  function onCollision(q) {
    currentQ = q;
    audio.sfx("collision");
    const modal = $("modal-question");
    $("modal-kicker").textContent = "Ouch! Get it right to win your life back";
    // problem and ask on separate lines — "x − 4 = 12.   x = ?" rendered as
    // one string collapsed to "…12. x = ?", which reads like 12·x
    const { problem, ask } = splitPrompt(q.prompt);
    $("modal-prompt").innerHTML = toMathHtml(problem);
    $("modal-ask").innerHTML = toMathHtml(ask);
    $("modal-ask").hidden = ask === "";
    $("modal-feedback").hidden = true;
    $("btn-continue").hidden = true;

    const choices = $("modal-choices");
    choices.innerHTML = "";
    const fibForm = $("modal-fib-form");

    if (q.type === "mc") {
      fibForm.hidden = true;
      q.choices.forEach((c, i) => {
        const b = document.createElement("button");
        b.className = "choice-btn";
        b.textContent = c;
        b.addEventListener("click", () => resolveAnswer(i));
        choices.appendChild(b);
      });
    } else {
      fibForm.hidden = false;
      const input = $("modal-fib-input");
      input.value = "";
      setTimeout(() => input.focus(), 30);
    }
    modal.hidden = false;
  }

  $("modal-fib-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("modal-fib-input").value;
    if (v.trim() === "") return;
    resolveAnswer(v);
  });

  function resolveAnswer(raw) {
    const { correct, over, earnedBonus, run } = game.answer(raw, currentQ);
    $("modal-choices").innerHTML = "";
    $("modal-fib-form").hidden = true;
    const fb = $("modal-feedback");
    const verdict = $("feedback-verdict");
    const explain = $("feedback-explain");
    fb.hidden = false;
    $("btn-continue").hidden = false;

    if (correct) {
      audio.sfx(earnedBonus ? "extralife" : "correct");
      verdict.className = "feedback-verdict good";
      verdict.textContent = earnedBonus
        ? `Life back — and ${STREAK_TARGET} in a row means an EXTRA life!`
        : "Correct! Your life is back.";
      explain.textContent = earnedBonus ? "" : `Streak: ${run.streak} of ${STREAK_TARGET} toward a bonus life.`;
      $("btn-continue").textContent = "Keep climbing";
    } else {
      audio.sfx(over ? "gameover" : "wrong");
      verdict.className = "feedback-verdict bad";
      verdict.textContent = over ? "Not this time…" : "Not quite — that life stays lost.";
      // her rule from Session 3: a wrong answer MUST come with the explanation
      explain.innerHTML = toMathHtml(currentQ.explain || "");
      $("btn-continue").textContent = over ? "See your score" : "Keep climbing";
    }
  }

  $("btn-continue").addEventListener("click", () => {
    $("modal-question").hidden = true;
    game.resume(); // decides: back to climbing, or game over
  });

  // ---------- pause ----------
  $("btn-pause").addEventListener("click", pauseGame);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });
  function pauseGame() {
    if (game.getState() !== "running") return;
    game.pause();
    $("overlay-pause").hidden = false;
  }
  $("btn-resume").addEventListener("click", () => {
    $("overlay-pause").hidden = true;
    game.unpause();
  });
  $("btn-quit").addEventListener("click", () => {
    $("overlay-pause").hidden = true;
    game.stop();
    audio.stopMusic();
    show("title");
  });

  // ---------- game over (all black, with stars) ----------
  function onGameOver(run, meters) {
    audio.stopMusic();
    const s = run.stats;
    $("gameover-stats").innerHTML =
      `You climbed <b>${meters} m</b><br/>` +
      `Math questions: <b>${s.questionsCorrect} / ${s.questionsAsked}</b> correct<br/>` +
      (s.bestStreak > 0 ? `Best streak: <b>${s.bestStreak}</b>` : "") +
      (s.bonusLives > 0 ? ` · Bonus lives earned: <b>${s.bonusLives}</b>` : "");
    show("gameover");
  }

  $("btn-again").addEventListener("click", () => { audio.sfx("click"); startGame(); });
  $("btn-menu").addEventListener("click", () => { audio.sfx("click"); show("title"); });
  $("btn-share").addEventListener("click", () => shareCard());

  // score card as a PNG the player can save / send on WhatsApp
  function shareCard() {
    const run = game.getRun();
    const s = run.stats;
    const c = document.createElement("canvas");
    c.width = 1080; c.height = 1080;
    const x = c.getContext("2d");

    x.fillStyle = "#000";
    x.fillRect(0, 0, 1080, 1080);
    for (let i = 0; i < 120; i++) { // stars
      x.globalAlpha = 0.3 + Math.random() * 0.7;
      x.fillStyle = "#fff";
      x.beginPath();
      x.arc(Math.random() * 1080, Math.random() * 1080, Math.random() * 2.2, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;

    // the circle (happy on the card — it's a trophy, not a tombstone)
    x.shadowColor = settings.circleColor; x.shadowBlur = 60;
    x.fillStyle = settings.circleColor;
    x.beginPath(); x.arc(540, 320, 130, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;
    x.fillStyle = "#0b0f1e";
    x.beginPath(); x.arc(495, 290, 18, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(585, 290, 18, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#0b0f1e"; x.lineWidth = 16; x.lineCap = "round";
    x.beginPath(); x.arc(540, 340, 62, Math.PI * 0.15, Math.PI * 0.85); x.stroke();

    x.fillStyle = "#fff";
    x.textAlign = "center";
    x.font = "700 92px system-ui, sans-serif";
    x.fillText(`${game.meters()} m`, 540, 570);
    x.font = "400 44px system-ui, sans-serif";
    x.fillStyle = "#9aa5c5";
    x.fillText("climbed on Math Climb", 540, 635);
    x.fillStyle = "#fff";
    x.font = "600 48px system-ui, sans-serif";
    x.fillText(`${s.questionsCorrect}/${s.questionsAsked} math questions correct`, 540, 750);
    if (s.bestStreak > 0) {
      x.font = "400 40px system-ui, sans-serif";
      x.fillText(`best streak ${s.bestStreak}${s.bonusLives ? ` · ${s.bonusLives} bonus ${s.bonusLives === 1 ? "life" : "lives"}` : ""}`, 540, 820);
    }
    x.font = "400 36px system-ui, sans-serif";
    x.fillStyle = "#9aa5c5";
    x.fillText(`${bank.topics[chosenTopic].label} · ${LEVEL_LABELS[chosenLevel]}`, 540, 900);
    x.fillText("a game by Sanaya", 540, 1010);

    c.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "math-climb-score.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  // ---------- settings ----------
  const swatchRow = $("swatch-row");
  SWATCHES.forEach((color) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.style.background = color;
    b.style.setProperty("--sw", color);
    b.title = color;
    b.addEventListener("click", () => {
      settings = saveSettings({ ...settings, circleColor: color });
      applyCircleColor(color);
      markSwatch();
      $("color-picker").value = color;
      audio.sfx("click");
    });
    swatchRow.appendChild(b);
  });
  function markSwatch() {
    [...swatchRow.children].forEach((b) => b.classList.toggle("selected", b.title.toLowerCase() === settings.circleColor.toLowerCase()));
  }

  $("color-picker").value = settings.circleColor;
  $("color-picker").addEventListener("input", (e) => {
    settings = saveSettings({ ...settings, circleColor: e.target.value });
    applyCircleColor(settings.circleColor);
    markSwatch();
  });

  $("music-on").checked = settings.musicOn;
  $("music-volume").value = settings.musicVolume;
  $("sfx-volume").value = settings.sfxVolume;
  markSwatch();

  $("music-on").addEventListener("change", (e) => {
    settings = saveSettings({ ...settings, musicOn: e.target.checked });
    audio.applySettings(settings);
    updateMusicNotice();
  });
  $("music-volume").addEventListener("input", (e) => {
    settings = saveSettings({ ...settings, musicVolume: e.target.value });
    audio.applySettings(settings);
  });
  $("sfx-volume").addEventListener("input", (e) => {
    settings = saveSettings({ ...settings, sfxVolume: e.target.value });
    audio.applySettings(settings);
    audio.sfx("correct"); // let them hear the new volume
  });
  function updateMusicNotice() { $("music-missing").hidden = audio.musicStatus() !== false; }

  function applyCircleColor(color) {
    document.documentElement.style.setProperty("--circle", color);
    game.setCircleColor(color);
  }

  // ---------- input: keyboard + touch halves ----------
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (game.getState() === "running") pauseGame();
      else if (game.getState() === "paused") { $("overlay-pause").hidden = true; game.unpause(); }
      return;
    }
    if (!$("modal-question").hidden) return; // typing an answer, not steering
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") game.setKeys({ left: true });
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") game.setKeys({ right: true });
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") game.setKeys({ left: false });
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") game.setKeys({ right: false });
  });

  const canvas = $("game-canvas");
  canvas.addEventListener("pointerdown", (e) => {
    if (game.getState() !== "running") return;
    const half = e.clientX < window.innerWidth / 2;
    game.setKeys(half ? { left: true } : { right: true });
  });
  const releaseTouch = () => game.setKeys({ left: false, right: false });
  canvas.addEventListener("pointerup", releaseTouch);
  canvas.addEventListener("pointercancel", releaseTouch);

  return { show, onHud, onCollision, onGameOver, pickQuestion: () => bag.next() };
}
