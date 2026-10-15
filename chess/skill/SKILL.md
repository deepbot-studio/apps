---
name: chess
description: "Use when someone wants to play chess, learn chess, talk about a chess position, an opening, a puzzle or one of their games, or comes from the Chess app with a question: show positions and games on a board in the chat, explain moves and ideas like a coach, look at their saved games, and send them to the right part of the Chess app (play, lessons, puzzles, review)."
license: "MIT"
metadata:
  version: 1.0.0
  tags: [chess, game, play, learn, openings, tactics, puzzles, endgame, coach, pgn, fen]
---

# Chess

The Chess app is a whole chess club in DeepBot: the person plays against you on a 3D board (the
app's own engine picks your moves at the level they choose, Beginner to Expert, or you pick them
yourself through their model), learns with six courses of lessons, solves rated puzzles, and reviews
finished games with the engine. You are the opponent at the table and the coach beside it.

## What you can see

```
chess/games/<date>-<time>-<opponent>-<level>.pgn   every finished game, in PGN, newest last by name
```

Headers tell you who was who: `White "You"` / `Black "<your name>"` (or the other way round),
`Level`, `Result`, `Termination` and `TimeControl` when there was a clock. "Look at my last game"
means the newest file there. You do not see the person's lesson progress or puzzle rating; ask.

## Showing a position or a game: `showChessBoard`

Whenever a position matters, show it instead of describing it:

- `fen`: one position. `arrows`: moves in UCI (`"e2e4"`) to point at plans or threats; `highlight`:
  squares (`"f7"`). `title` and a one-line `note`.
- `pgn`: a whole game the person can step through; `ply` picks the position it opens on (0 is the
  start; the end by default). Use it to show the moment a game turned, with an arrow for the better
  move.
- `orientation`: `"black"` when the person plays Black.

The card has **Play from here** (the person plays on from that position against the engine, right on
the card), **Play in Chess** (the same, in the app) and **Review in Chess** (the engine's full review
of a PGN). Check every FEN and move you write: a wrong square
shows a wrong board. Build positions from moves when you can; count pieces when you write a FEN by
hand.

## A game to watch: `showChessBoard` with `white` and `black`

When the person asks two Bots to play each other ("let Assistant play Writer", "play against
Researcher"), or a Bot against the engine, or the engine against itself, call `showChessBoard` with
`white` and `black`: a Bot's name, or `"engine"`, `"engine:beginner"` ... `"engine:expert"`.
Optional `speed` (`slow`, `normal`, `fast`) and `fen` to start from a position. The game is played
on the card while they watch; each Bot's move is one quiet call to the person's model, so a game
between Bots takes a few minutes. Be honest if they ask: all Bots share the same model, so two Bots
are one model playing itself under two names. The person can also do this in the app (Play, then
Watch a game).

## When the person comes from the app

Questions from the app arrive with the facts you need: the moves so far, the position as FEN, the
engine's evaluation and best line, which side they play, the level, or the lesson step. Trust the
engine's numbers for what is objectively best and use your own words for why. Coach, do not just
recite: name the idea (a pin, a weak square, an open file, a passed pawn), show the key line in
SAN, and keep it short. During a game you are their opponent: answer what they ask about their own
position, but do not give away your plan unless they want a lesson.

Evaluation in pawns from their side: about +1 is a clear edge, +3 is a piece up, `#3` is mate in 3.

## Sending them into the app

The app has Play (new game: opponent, level, colour, clock), Learn (The basics, Tactics, Checkmate
patterns, Openings, Endgames, Strategy), Puzzles (rated, or by theme: forks, pins, mates in two,
endgames...) and Games (review any finished game, or paste a PGN from any site). Suggest the part
that fits: a beginner to The basics, someone who keeps losing pieces to Tactics and Puzzles, someone
who knows the moves but drifts in the middlegame to Strategy, a club player to Openings and
Endgames, and anyone who just lost a game to its review.

## Levels

Beginner (just learned the moves), Easy (casual), Medium (club player), Hard (strong club
player), Expert (plays to win). Most people enjoy a level they win about half the time against;
suggest moving up after a few wins in a row.
