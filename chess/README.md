# Chess

Chess with your Bot at the table, and an app for DeepBot.

Play on a wooden 3D board (or a flat one) against your Bot at five levels, from someone who just
learned the moves to a good club player, with a clock, hints, takebacks and sound. Or let the Bot
pick its own moves with your AI model. Learn with six courses of lessons on the board, train with
thousands of rated puzzles by theme, and review every game with the engine, with your Bot explaining
any move beside the board.

## Install

Put this folder in DeepBot's `apps` folder and restart DeepBot. The app appears under Apps, and the
Bot gains the chess skill. Finished games are PGN files in your workspace under `chess/games/`.

## What is in here

```
app.json           the manifest: the page, the chat card, permissions
skill/SKILL.md     what the Bot reads: showing boards, coaching, the parts of the app
ui/chess.html      the page (Play, Learn, Puzzles, Games, Review)
ui/board.html      the chat card: a position or a game on a board
ui/lib/rules.js    the rules: moves, check, mate, draws, FEN, SAN, PGN
ui/lib/engine.js   the engine: search, evaluation, levels; runs in a worker (engine-worker.js)
ui/lib/board3d.js  the 3D board (three.js from DeepBot); board2d.js the flat one
ui/lib/lessons.js  the six courses
ui/data/           the puzzles
tests/             bun test: perft for the rules, the engine, every lesson position
listing.md         the catalogue listing: description, FAQ, changelog
DECISIONS.md       why it is built this way
NOTICE             bundled third-party data and fonts
```

## Test

```
bun test chess/tests
```
