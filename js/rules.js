// rules.js — Sanaya's game law, as she decided it (Session 5, 30 Jun 2026):
//
//   "You lose a life when you hit an obstacle. A math question then appears to
//    RECOVER it — get it right, the life comes back; get it wrong, it stays
//    lost. Lose 3 lives and the game is over. And 5 correct in a row earns an
//    extra life."  (math as recovery — a power-up you earn, not a punishment)
//
// Pure state machine: no DOM, no canvas, no timers. The same file runs under
// Node tests and in the browser. game.js calls these three functions and
// draws whatever the returned state says.

export const STARTING_LIVES = 3;
export const STREAK_TARGET = 5; // correct answers in a row → +1 extra life

// A fresh run. `stats` feeds the game-over screen and the share card.
export function newRun() {
  return {
    lives: STARTING_LIVES,
    streak: 0,          // current correct-in-a-row count
    pendingQuestion: false, // a collision happened; a recovery question is owed
    over: false,
    stats: {
      questionsAsked: 0,
      questionsCorrect: 0,
      bestStreak: 0,
      livesRecovered: 0,  // lives won back by answering the recovery question
      bonusLives: 0,      // extra lives earned via the 5-in-a-row streak
      collisions: 0,
    },
  };
}

// The hit costs a life IMMEDIATELY (the HUD shows it drop), then a recovery
// question is owed. The run is NOT over yet even at 0 lives — the player
// always gets the recovery chance; that is the whole point of the mechanic.
export function applyCollision(run) {
  if (run.over || run.pendingQuestion) return run; // ignore double-hits mid-modal
  run.lives -= 1;
  run.pendingQuestion = true;
  run.stats.collisions += 1;
  return run;
}

// Resolve the recovery question. Only AFTER this do we decide game-over —
// a correct answer at 0 lives saves the run.
export function applyAnswer(run, isCorrect) {
  if (!run.pendingQuestion || run.over) return run;
  run.pendingQuestion = false;
  run.stats.questionsAsked += 1;

  if (isCorrect) {
    run.stats.questionsCorrect += 1;
    run.lives += 1; // the lost life comes back
    run.stats.livesRecovered += 1;
    run.streak += 1;
    if (run.streak > run.stats.bestStreak) run.stats.bestStreak = run.streak;
    if (run.streak >= STREAK_TARGET) {
      run.lives += 1; // the 5-in-a-row bonus life
      run.stats.bonusLives += 1;
      run.streak = 0; // the streak restarts after paying out
    }
  } else {
    run.streak = 0; // a wrong answer breaks the streak; the lost life stays lost
  }

  run.over = run.lives <= 0;
  return run;
}
