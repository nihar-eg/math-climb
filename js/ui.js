// ui.js — every screen, button, and the question modal. The game world lives
// in game.js; the rules in rules.js; the words in copy.js; the colours in
// themes.js. This file only moves the player between screens and shows what
// the game reports.

import { getLevel, ShuffleBag } from "./bank.js";
import { loadSettings, saveSettings, circleColorForTheme } from "./settings.js";
import { STREAK_TARGET } from "./rules.js";
import { splitPrompt, toMathHtml } from "./mathtext.js";
import { COPY } from "./copy.js";
import { loadRecords, saveRecords, bestFor, recordDistance } from "./records.js";
import { THEMES, applyTheme, getTheme } from "./themes.js";
import * as audio from "./audio.js";

const TOPIC_ICONS = { algebra: "𝑥", exponents: "xⁿ", ratios: "⚖", coordinates: "⊹" };
const TOPIC_ACCENTS = {
  algebra: "var(--accent-a)",
  exponents: "var(--accent-b)",
  ratios: "var(--accent-c)",
  coordinates: "var(--accent-d)",
};
const LEVEL_ORDER = ["grade6", "grade7", "grade8"];
// the score card is black in every theme (her design), so its greys are fixed
const CARD_DIM = "#9aa5c5";

const STEER_HINT_HOLD_MS = 3500;  // how long the "← → to steer" reminder stays
const STEER_HINT_FADE_MS = 700;   // must match the CSS transition on #steer-hint

const $ = (id) => document.getElementById(id);

export function initUI({ bank, game }) {
  let settings = loadSettings();
  let records = loadRecords();
  let chosenTopic = null;
  let chosenLevel = null;
  let bag = null;
  let currentQ = null;
  let steerHintShown = false;

  // ---------- words first, so nothing renders as an empty element ----------
  // Any element carrying data-copy="key" gets COPY[key] as its text.
  for (const el of document.querySelectorAll("[data-copy]")) {
    const value = COPY[el.dataset.copy];
    // a renamed or deleted key would otherwise render as a silent blank button
    if (typeof value !== "string") { console.warn(`[copy] missing key "${el.dataset.copy}"`); continue; }
    el.textContent = value;
  }
  for (const el of document.querySelectorAll("[data-copy-title]")) {
    const value = COPY[el.dataset.copyTitle];
    if (typeof value === "string") el.title = value;
  }
  $("modal-fib-input").placeholder = COPY.fibPlaceholder; // a placeholder isn't text content

  applyThemeEverywhere(settings.theme);
  applyCircleColor(settings.circleColor);
  audio.applySettings(settings);

  // ---------- screen switching ----------
  const screens = ["title", "topics", "levels", "settings", "game", "gameover"];
  function show(name) {
    // leaving the title screen must also dismiss the how-to card — otherwise it
    // is still open (and seenHowTo still unwritten) when the player comes back
    if (name !== "title" && !$("overlay-howto").hidden) closeHowTo();
    for (const s of screens) $(`screen-${s}`).classList.toggle("active", s === name);
    if (name === "title") refreshResumeButton();
  }

  document.querySelectorAll("[data-back]").forEach((b) =>
    b.addEventListener("click", () => { audio.sfx("click"); show(b.dataset.back); })
  );

  // ---------- title ----------
  $("btn-play").addEventListener("click", () => { audio.sfx("click"); show("topics"); });
  $("btn-settings").addEventListener("click", () => { audio.sfx("click"); show("settings"); });
  const isTouch = "ontouchstart" in window && window.innerWidth < 900;
  if (isTouch) $("mobile-notice").hidden = false;

  // ---------- how to play ----------
  const howToSteps = $("howto-steps");
  COPY.howToSteps.forEach((text, i) => {
    const li = document.createElement("li");
    const num = document.createElement("span");
    num.className = "howto-num";
    num.textContent = String(i + 1);
    const body = document.createElement("span");
    body.textContent = text;
    li.append(num, body);
    howToSteps.appendChild(li);
  });

  function openHowTo() {
    const overlay = $("overlay-howto");
    overlay.hidden = false;
    // Take focus, or a keyboard player tabs straight into the buttons behind
    // the card. preventScroll matters: the close button is at the BOTTOM, and a
    // plain focus() scrolls a tall card straight past its own heading — on a
    // short phone screen the player would open the tutorial at step 7.
    $("btn-howto-close").focus({ preventScroll: true });
    overlay.scrollTop = 0;
    const card = overlay.querySelector(".howto-card");
    if (card) card.scrollTop = 0;
  }
  function closeHowTo() {
    $("overlay-howto").hidden = true;
    // remember, so it only ambushes a first-time player once
    if (!settings.seenHowTo) settings = saveSettings({ ...settings, seenHowTo: true });
  }
  $("btn-howto").addEventListener("click", () => { audio.sfx("click"); openHowTo(); });
  $("btn-howto-close").addEventListener("click", () => { audio.sfx("click"); closeHowTo(); });
  // her review note: it took a few tries to work out how the game works
  if (!settings.seenHowTo) openHowTo();

  // ---------- topics (built from the question bank itself) ----------
  const grid = $("topic-grid");
  for (const [key, topic] of Object.entries(bank.topics)) {
    const btn = document.createElement("button");
    btn.className = "topic-card";
    btn.style.setProperty("--accent", TOPIC_ACCENTS[key] || "var(--accent-a)");
    const nQuestions = Object.values(topic.levels).reduce((n, rows) => n + rows.length, 0);
    btn.innerHTML = `<span class="topic-icon">${TOPIC_ICONS[key] || "∑"}</span>
      <span>${topic.label}</span>
      <span class="topic-count">${COPY.questionCount(nQuestions)}</span>`;
    btn.addEventListener("click", () => {
      audio.sfx("click");
      chosenTopic = key;
      $("levels-topic-name").textContent = topic.label;
      refreshLevelBests();
      show("levels");
    });
    grid.appendChild(btn);
  }

  // ---------- levels ----------
  const levelButtons = $("level-buttons");
  for (const level of LEVEL_ORDER) {
    const btn = document.createElement("button");
    btn.className = "btn btn-level";
    btn.dataset.level = level;
    const tag = document.createElement("span");
    tag.className = "level-tag";
    tag.textContent = COPY.levelTags[level];
    btn.append(document.createTextNode(COPY.levelLabels[level] + " "), tag);
    levelButtons.appendChild(btn);
  }

  // Each level button carries the best distance reached on it, so the player can
  // see what they're chasing before they start rather than only afterwards.
  function refreshLevelBests() {
    for (const btn of levelButtons.querySelectorAll(".btn-level")) {
      let tag = btn.querySelector(".level-best");
      const best = bestFor(records, chosenTopic, btn.dataset.level);
      if (!best) { if (tag) tag.remove(); continue; }
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "level-best";
        btn.appendChild(tag);
      }
      tag.textContent = COPY.levelBest(best);
    }
  }

  levelButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-level");
    if (!btn) return;
    chosenLevel = btn.dataset.level;
    startGame(); // this click is also the browser's audio-unlock gesture
  });

  // Starting a new run is the ONE thing that discards a suspended one — picking
  // a topic and a level is an unambiguous "I want a fresh run".
  function startGame() {
    const rows = getLevel(bank, chosenTopic, chosenLevel);
    if (rows.length === 0) return; // bank validator would have warned at boot
    bag = new ShuffleBag(rows);
    $("hud-topic").textContent = `${bank.topics[chosenTopic].label} · ${COPY.levelLabels[chosenLevel]}`;
    audio.unlock();
    show("game");
    game.resize();
    game.setCircleColor(settings.circleColor);
    game.start();
    maybeShowSteerHint();
  }

  // A one-time nudge at the bottom of the first run, then it fades and never
  // comes back — the how-to card covers it for anyone who wants it again.
  function maybeShowSteerHint() {
    if (steerHintShown) return;
    steerHintShown = true;
    const hint = $("steer-hint");
    // arrow keys mean nothing on a touch device — and mobileNotice two screens
    // back has already promised hold-to-steer
    hint.textContent = isTouch ? COPY.steerHintTouch : COPY.steerHint;
    hint.hidden = false;
    hint.classList.remove("fading");
    setTimeout(() => {
      hint.classList.add("fading");
      setTimeout(() => { hint.hidden = true; }, STEER_HINT_FADE_MS);
    }, STEER_HINT_HOLD_MS);
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
    $("modal-kicker").textContent = COPY.modalKicker;
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
      setTimeout(() => choices.firstChild && choices.firstChild.focus(), 30);
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
    // the question interrupts twitch play — give the keyboard the way back in
    $("btn-continue").focus();

    if (correct) {
      audio.sfx(earnedBonus ? "extralife" : "correct");
      verdict.className = "feedback-verdict good";
      verdict.textContent = earnedBonus ? COPY.verdictBonus(STREAK_TARGET) : COPY.verdictCorrect;
      explain.textContent = earnedBonus ? "" : COPY.streakNote(run.streak, STREAK_TARGET);
      $("btn-continue").textContent = COPY.btnKeepGoing;
    } else {
      audio.sfx(over ? "gameover" : "wrong");
      verdict.className = "feedback-verdict bad";
      verdict.textContent = over ? COPY.verdictFinal : COPY.verdictWrong;
      // her rule from Session 3: a wrong answer MUST come with the explanation
      explain.innerHTML = toMathHtml(currentQ.explain || "");
      $("btn-continue").textContent = over ? COPY.btnSeeScore : COPY.btnKeepGoing;
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
    game.suspend();          // put the run down, don't throw it away
    audio.stopMusic();
    show("title");
  });

  // ---------- resuming a suspended run ----------
  // The button only exists while there is something to go back to, so the front
  // screen looks exactly as before on a first visit.
  function refreshResumeButton() {
    const btn = $("btn-resume-run");
    const can = game.isResumable();
    btn.hidden = !can;
    if (can) btn.textContent = COPY.btnResumeRun(game.meters());
    // only one primary button at a time — when there's a run waiting, going
    // back to it is the main action and starting over is the secondary one
    $("btn-play").classList.toggle("btn-primary", !can);
  }

  $("btn-resume-run").addEventListener("click", () => {
    audio.sfx("click");
    audio.unlock();          // this click is the browser's audio gesture again
    show("game");
    game.resize();
    game.resumeRun();
  });

  // ---------- game over (all black, with stars) ----------
  function onGameOver(run, meters) {
    audio.stopMusic();
    const s = run.stats;
    const lines = [COPY.statsClimbed(meters), COPY.statsQuestions(s.questionsCorrect, s.questionsAsked)];
    if (s.bestStreak > 0) {
      lines.push(COPY.statsStreak(s.bestStreak) + (s.bonusLives > 0 ? COPY.statsBonus(s.bonusLives) : ""));
    }
    $("gameover-stats").innerHTML = lines.join("<br/>"); // join, so no trailing <br/> when there's no streak

    // A finished run is the only thing that sets a record — a run you walked
    // away from doesn't count. Recorded per topic AND level, so an easy level
    // can't take the credit for a hard one.
    const result = recordDistance(records, chosenTopic, chosenLevel, meters);
    const bestLine = $("gameover-best");
    if (result.isBest) {
      records = saveRecords(result.records);
      bestLine.textContent = COPY.newBest(result.meters);
      bestLine.classList.add("is-best");
      bestLine.hidden = false;
      audio.sfx("extralife");            // it should sound like something
    } else if (result.previous > 0) {
      bestLine.textContent = COPY.bestSoFar(result.previous);
      bestLine.classList.remove("is-best");
      bestLine.hidden = false;
    } else {
      bestLine.hidden = true;            // nothing set yet, and this run scored 0
    }

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

    // the card matches the game-over screen (black + stars) in every theme
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
    const ink = getTheme(settings.theme).tokens["--ink"];
    x.shadowColor = settings.circleColor; x.shadowBlur = 60;
    x.fillStyle = settings.circleColor;
    x.beginPath(); x.arc(540, 320, 130, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;
    // the card is always black, and the picker allows any colour — ring it so a
    // dark circle still reads
    x.strokeStyle = "rgba(255,255,255,0.55)"; x.lineWidth = 3; x.stroke();
    x.fillStyle = ink;
    x.beginPath(); x.arc(495, 290, 18, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(585, 290, 18, 0, Math.PI * 2); x.fill();
    x.strokeStyle = ink; x.lineWidth = 16; x.lineCap = "round";
    x.beginPath(); x.arc(540, 340, 62, Math.PI * 0.15, Math.PI * 0.85); x.stroke();

    x.fillStyle = "#fff";
    x.textAlign = "center";
    x.font = "700 92px system-ui, sans-serif";
    x.fillText(`${game.meters()} m`, 540, 570);
    x.font = "400 44px system-ui, sans-serif";
    x.fillStyle = CARD_DIM;
    x.fillText(COPY.cardClimbed, 540, 635);
    x.fillStyle = "#fff";
    x.font = "600 48px system-ui, sans-serif";
    x.fillText(COPY.cardQuestions(s.questionsCorrect, s.questionsAsked), 540, 750);
    if (s.bestStreak > 0) {
      x.font = "400 40px system-ui, sans-serif";
      x.fillText(COPY.cardStreak(s.bestStreak, s.bonusLives), 540, 820);
    }
    x.font = "400 36px system-ui, sans-serif";
    x.fillStyle = CARD_DIM;
    x.fillText(`${bank.topics[chosenTopic].label} · ${COPY.levelLabels[chosenLevel]}`, 540, 900);
    x.fillText(COPY.cardCredit, 540, 1010);

    c.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "math-climb-score.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  // ---------- settings: theme ----------
  const themeRow = $("theme-row");
  for (const theme of Object.values(THEMES)) {
    const chip = document.createElement("button");
    chip.className = "theme-chip";
    chip.dataset.theme = theme.id;

    const preview = document.createElement("span");
    preview.className = "theme-preview";
    preview.style.background = theme.tokens["--bg-deep"];
    for (const color of theme.obstacles.slice(0, 4)) {
      const bar = document.createElement("span");
      bar.style.background = color;
      preview.appendChild(bar);
    }
    const name = document.createElement("span");
    name.className = "theme-chip-name";
    name.textContent = theme.label;

    chip.append(preview, name);
    chip.addEventListener("click", () => { audio.sfx("click"); chooseTheme(theme.id); });
    themeRow.appendChild(chip);
  }

  function chooseTheme(id) {
    // a circle the player never chose follows the theme; one they picked on
    // purpose survives the switch untouched
    const circleColor = circleColorForTheme(settings, id);
    settings = saveSettings({ ...settings, theme: id, circleColor });
    applyThemeEverywhere(id);
    applyCircleColor(settings.circleColor);
    buildSwatches();
    $("color-picker").value = settings.circleColor;
    markTheme();
  }

  function applyThemeEverywhere(id) {
    applyTheme(document.documentElement, id);
    game.setTheme(id);
  }

  function markTheme() {
    [...themeRow.children].forEach((c) => c.classList.toggle("selected", c.dataset.theme === settings.theme));
  }

  // ---------- settings: circle colour ----------
  const swatchRow = $("swatch-row");
  function buildSwatches() {
    swatchRow.innerHTML = "";
    for (const color of getTheme(settings.theme).swatches) {
      const b = document.createElement("button");
      b.className = "swatch";
      b.style.background = color;
      b.style.setProperty("--sw", color);
      b.title = color;
      b.addEventListener("click", () => {
        settings = saveSettings({ ...settings, circleColor: color, circleCustom: true });
        applyCircleColor(color);
        markSwatch();
        $("color-picker").value = color;
        audio.sfx("click");
      });
      swatchRow.appendChild(b);
    }
    markSwatch();
  }
  function markSwatch() {
    [...swatchRow.children].forEach((b) =>
      b.classList.toggle("selected", b.title.toLowerCase() === settings.circleColor.toLowerCase()));
  }

  $("color-picker").value = settings.circleColor;
  $("color-picker").addEventListener("input", (e) => {
    settings = saveSettings({ ...settings, circleColor: e.target.value, circleCustom: true });
    applyCircleColor(settings.circleColor);
    markSwatch();
  });

  buildSwatches();
  markTheme();

  // ---------- settings: sound ----------
  $("music-on").checked = settings.musicOn;
  $("music-volume").value = settings.musicVolume;
  $("sfx-volume").value = settings.sfxVolume;

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
  // audio.js only learns the music file is absent after the first unlock, so ask
  // again shortly after a run starts — otherwise this notice never shows at all
  setTimeout(updateMusicNotice, 3000);

  function applyCircleColor(color) {
    document.documentElement.style.setProperty("--circle", color);
    game.setCircleColor(color);
  }

  // ---------- input: keyboard + touch halves ----------
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("overlay-howto").hidden) { closeHowTo(); return; }
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
