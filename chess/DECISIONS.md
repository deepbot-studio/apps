# Decisions

**Our own engine, not Stockfish.** Stockfish is far stronger, but it is GPL-3: shipping it would put
the whole app under the GPL and rule out ever building the engine into DeepBot itself or offering a
paid version. Our engine (alpha-beta with the usual pruning, written for this app) plays roughly at a
strong club level, which is above almost everyone who will play it, and everything stays ours.

**Weaker levels play like weaker people.** A weak level that simply searches less still plays
machine-like moves and then blunders at random. Beginner looks one move ahead and does not count the
recapture (it grabs a defended pawn with its queen); Easy and Medium score every move and choose among
the good ones with some randomness; Hard and Expert search for real on a clock. Self-play confirms the
order: each level beats the one below.

**The engine plays, the Bot is the opponent.** A language model playing chess move by move is slow,
costs tokens and loses track of the board. So the engine picks the moves at the chosen level, and the
Bot (its name, its face from DeepBot, its remarks) sits at the table: it reacts to a strong move or a
slip, explains positions beside the board, and reviews games. "The Bot itself" is there too, as an
option: the move is asked of the person's model through `deepbot.think`, checked against the legal
moves, asked again once, and played by the engine if the model still cannot answer.

**3D by default, flat on request.** The board is the reason to open the app, so it is a real board:
lathe-turned pieces built in code (no model files to licence), wood textures painted on a canvas,
soft shadows, render-on-demand so an idle board costs nothing. Computers without WebGL get the flat
board automatically. Lessons and cards work the same on both.

**Lessons are data, checked by tests.** Every lesson position is a FEN and every expected move is
played through the rules in `tests/lessons.test.ts`, so a typo in a lesson fails the build instead of
confusing a learner. Steps that ask for "a good move" are judged by the engine, so any move nearly as
good as the best one counts.

**Puzzles from Lichess (CC0).** Writing thousands of good puzzles by hand is not realistic; the
Lichess database is public domain and each puzzle was played and rated by many people. We ship a
selection for quality (popular, often played, stable rating) spread over every rating and theme, and
every one is replayed through our rules in the build.

**Games are files.** Finished games are PGN files in `chess/games/`, readable by the Bot ("look at my
last game") and by any chess program. Settings, progress and the game in progress live in the app's
storage.
