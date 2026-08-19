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
  // The never-white-screen rule. This message must not depend on the theme:
  // it also has to work when the STYLESHEET is what failed, so it paints its
  // own background and uses dark ink rather than any CSS variable. (It used to
  // hard-code the neon theme's near-white text, which measured 1.01:1 against
  // the pastel background — the one guard against a white screen WAS a white
  // screen.)
  console.error(err);
  document.body.innerHTML =
    `<div style="display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;background:#ffffff;color:#1a1a1a;font:18px system-ui,sans-serif">
       <p>Something went wrong loading the game.<br/>
       <small style="color:#555555">${String(err).replace(/</g, "&lt;")}</small></p>
     </div>`;
});
