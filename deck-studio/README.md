# Deck studio

Presentations from a sentence, a text or a file, and an app for DeepBot.

Tell your Bot what the talk is about ("a 10-minute Series A pitch from my notes") and it writes the
story and every slide; Deck studio designs them. Twelve themes plus your own brand from the Logo
designer, seventeen layouts (title, sections, points, text and picture, cards, big numbers, charts,
quotes, timelines, steps, comparisons and pricing, tables, people, full pictures, statements,
closing), pictures beside or behind any slide, icons, charts and transitions. Click any text to change
it, ask the Bot beside the deck, present full screen with notes, and export an editable PowerPoint, a
PDF or a single web page that presents itself or scrolls as a site.

## Install

Put this folder in DeepBot's `apps` folder and restart DeepBot. The app appears under Apps, and the
Bot gains the deck skill. Then ask your Bot: *"Make me a pitch deck about ..."*

Decks are plain files in your workspace under `decks/<slug>/`: `deck.json` (the slides as layouts and
their fields, never positions), the deck's `images/` and every export, so they are yours to read,
edit, back up or move.

## What is in here

```
app.json         the manifest: the page, the chat card, permissions
skill/SKILL.md   what the Bot reads: the story, the deck file, layouts, themes and pictures
ui/              the Deck studio page and the chat card (plain ES modules, no build step)
ui/lib/          the slide renderer, layouts, themes, charts, icons, exports
ui/fonts/        the bundled fonts for every theme
ui/vendor/       PptxGenJS and html-to-image, for the exports
tests/           bun test, with a sample deck as a fixture
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
