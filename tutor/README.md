# Tutor

A personal tutor for children and adults, and an app for DeepBot.

Tell your Bot what someone needs to learn ("quadratic functions for my daughter, exam in three weeks")
and it plans a course for exactly that learner, then teaches it in a page made for learning: formulas,
worked examples revealed one step at a time, graphs with sliders, ten simulations, nine kinds of
questions checked on the spot, exercises solved step by step, flashcards on a spaced-repetition
schedule, stars, streaks and a progress page. A playful look for children, a calm one for adults.

## Install

Put this folder in DeepBot's `apps` folder and restart DeepBot. The app appears under Apps, and the
Bot gains the tutor skill. Then ask your Bot: *"Make me a course on ..."*

Courses are plain JSON files in your workspace under `tutor/`, so they are yours to read, edit, back
up or move.

## What is in here

```
app.json         the manifest: the page, the two chat cards, permissions
skill/SKILL.md   what the Bot reads: how to plan a course and write lessons
ui/              the Learn page and the chat cards (plain ES modules, no build step)
ui/lib/          the lesson renderer, the maths language, graphs, simulations, progress
tests/           bun test, with a sample course as a fixture
listing.md       the catalogue listing: description, FAQ, changelog
DECISIONS.md     why it is built this way
NOTICE           bundled third-party software and fonts
```

## Development

The interface is plain JavaScript served as files, so there is no build step. Run the tests with:

```
bun test
```

## Licence

MIT, see `LICENSE`. The DeepBot name and logo are not part of the licence. Bundled third-party
software and fonts, with their licences, are listed in `NOTICE`.
