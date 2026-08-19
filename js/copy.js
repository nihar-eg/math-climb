// copy.js — every word the player reads, in one place.
//
// ⚠️ SANAYA: THIS FILE IS YOURS TO REWRITE.
//
// You asked for language that sounds like it's actually for middle schoolers
// instead of a textbook. This is a FIRST DRAFT of that — a starting point, not
// a decision. Change any line you want: the words below are the only thing
// the player sees, so editing here changes the game. Nothing will break as
// long as you keep the quotes and the commas.
//
// The lines you already wrote (the level sub-heading, the credit) are kept
// exactly as they were — those are yours already.
//
// Two things worth knowing before you edit:
//   1. Slang ages fast. Anything trendy now can read as embarrassing in a
//      year, and this game has to still look good when someone opens it
//      months from now. Lines that are just punchy and confident age better
//      than lines chasing a specific trend.
//   2. You'll be asked to explain your choices. "I wrote it this way because
//      my friends actually talk like that" is a real answer. Anything you
//      can't explain is worth cutting.
//
// Keys marked (dynamic) are functions because a number gets dropped into them.

export const COPY = Object.freeze({
  // ---------------------------------------------------------------- title
  gameTitle: "MATH CLIMB",                 // working title — the real name is your call
  tagline: "Climb as high as you can. Dodge the bars. Math is your extra life.",
  btnPlay: "Let's go",
  // shown on the front screen only when a run is waiting to be picked back up;
  // the number is the distance you'd be returning to
  btnResumeRun: (m) => `Resume your run — ${m} m`,       // (dynamic)
  btnHowTo: "How to play",
  btnSettings: "Settings",
  credit: "a game by Sanaya",              // yours
  mobileNotice:
    "This one's way better on a laptop with a keyboard. On a phone, hold the left or right side of the screen to steer.",

  // ------------------------------------------------------------- how to play
  howToTitle: "How to play",
  // ⚠️ The numbers here (3 lives, 5 in a row) are checked against rules.js by
  // tests/copy.test.js — if the game's rules change, that test fails rather
  // than letting the tutorial quietly tell players the wrong thing.
  howToSteps: Object.freeze([
    "Steer with the ← → arrow keys, or A and D. On a phone, hold the left or right side of the screen.",
    "You start with 3 lives. You're climbing the whole time — don't hit the bars.",
    "Clip a bar and you lose a life — but you get a math question. Get it right and that life comes straight back.",
    "5 correct in a row and you earn a bonus life.",
    "At 0 lives the question is your last chance: get it right and you're still climbing, get it wrong and that's the run.",
    "Get one wrong and it shows you how the answer works before you carry on.",
    "It gets faster the whole way up, so you're going to crash eventually. That's the point — the math is how you stay alive.",
  ]),
  howToGotIt: "Got it",
  steerHint: "← → to steer",               // fades out during your first run
  steerHintTouch: "hold either side to steer",   // ...the phone version of the same nudge

  // --------------------------------------------------------------- topics
  topicsHeading: "Pick your topic",
  levelsSub: "Pick the level that fits your skill — not your age.",   // yours
  levelLabels: Object.freeze({
    grade6: "6th grade",
    grade7: "7th grade",
    grade8: "8th grade",
  }),
  levelTags: Object.freeze({
    grade6: "easy",
    grade7: "medium",
    grade8: "hard",
  }),
  questionCount: (n) => `${n} ${n === 1 ? "question" : "questions"}`,  // (dynamic)
  btnBack: "← Back",

  // the little labels that appear when you hover the bar at the top of a run
  hudLivesLabel: "Lives left",
  hudStreakLabel: "5 correct in a row = a bonus life",
  hudPauseLabel: "Pause (Esc)",

  // -------------------------------------------------------------- settings
  settingsHeading: "Settings",
  settingsTheme: "Colours",
  settingsCircle: "Your circle",
  settingsPickAny: "or pick any colour:",
  settingsSound: "Sound",
  settingsMusicOn: "Background music",
  settingsMusicVol: "Music volume",
  settingsSfxVol: "Sound effects",
  musicMissing: "Music's not in yet — sound effects still work.",

  // ------------------------------------------------- the recovery question
  modalKicker: "Oof! Get this right and you're back in.",
  fibPlaceholder: "your answer",
  btnAnswer: "Answer",
  verdictCorrect: "Nice! Life's back.",
  verdictBonus: (n) => `${n} in a row — that's a whole extra life.`,                     // (dynamic)
  streakNote: (have, need) => `Streak: ${have} of ${need} to a bonus life.`,             // (dynamic)
  verdictWrong: "Not it — that life's gone. Here's the move:",
  verdictFinal: "That's the run.",
  btnKeepGoing: "Back to it",
  btnSeeScore: "See how you did",

  // ----------------------------------------------------------------- pause
  paused: "Paused",
  btnResume: "Resume",
  btnQuit: "Back to menu",

  // ------------------------------------------------------------- game over
  gameOverTitle: "Game over",
  newBest: (m) => `New best — ${m} m!`,                                                  // (dynamic)
  bestSoFar: (m) => `Your best here: ${m} m`,                                            // (dynamic)
  levelBest: (m) => `best ${m} m`,          // shown on the level buttons  (dynamic)
  btnAgain: "Run it back",
  btnShare: "Save your score card",
  btnMenu: "Menu",
  statsClimbed: (m) => `You climbed <b>${m} m</b>`,                                      // (dynamic)
  statsQuestions: (right, asked) => `Math: <b>${right} / ${asked}</b> correct`,          // (dynamic)
  statsStreak: (n) => `Best streak: <b>${n}</b>`,                                        // (dynamic)
  statsBonus: (n) => ` · Bonus lives: <b>${n}</b>`,                                      // (dynamic)

  // ------------------------------------------- the score card you can save
  cardClimbed: "climbed on Math Climb",
  cardQuestions: (right, asked) => `${right}/${asked} math questions correct`,           // (dynamic)
  cardStreak: (n, bonus) =>                                                              // (dynamic)
    `best streak ${n}${bonus ? ` · ${bonus} bonus ${bonus === 1 ? "life" : "lives"}` : ""}`,
  cardCredit: "a game by Sanaya",          // yours
});
