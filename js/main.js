// main.js — boot: load the question bank, validate it (bad rows are skipped,
// never fatal), then hand everything to the UI and the game world.

import { validateBank } from "./bank.js";
import { createGame } from "./game.js";
import { initUI } from "./ui.js";

async function boot() {
  // no-cache: revalidate on every load, so an updated question bank is picked
  // up immediately (browsers otherwise cache JSON fetches heuristically)
  const res = await fetch("data/questions.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`could not load questions.json (${res.status})`);
  const { ok, errors, cleaned } = validateBank(await res.json());
  if (!ok) console.warn(`[bank] skipped ${errors.length} malformed question(s)`, errors);

  // ui needs game, game needs ui's hooks — so the hooks object is shared and
  // filled in right after both exist.
  const hooks = {};
  const game = createGame({ canvas: document.getElementById("game-canvas"), hooks });
  const ui = initUI({ bank: cleaned, game });
  hooks.onHud = ui.onHud;
  hooks.onCollision = ui.onCollision;
  hooks.onGameOver = ui.onGameOver;
  hooks.pickQuestion = ui.pickQuestion;
}

boot().catch((err) => {
  // the never-white-screen rule: if boot fails, say so in plain words
  console.error(err);
  document.body.innerHTML =
    `<div style="display:flex;height:100vh;align-items:center;justify-content:center;text-align:center;color:#eef2ff;font:18px system-ui">
       <p>Something went wrong loading the game.<br/>
       <small style="color:#9aa5c5">${String(err).replace(/</g, "&lt;")}</small></p>
     </div>`;
});
