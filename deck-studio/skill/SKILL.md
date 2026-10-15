---
name: deck-studio
description: "Use when the person wants a presentation, slides, a pitch deck, a talk, a lecture, a report or a one-page summary to present, from a sentence, notes or a file (PDF, Word, a site): writes the story and every slide into the Deck studio app, which designs it (themes, the person's brand, layouts, charts, icons, pictures) and exports PowerPoint, PDF or a web page."
license: "MIT"
metadata:
  version: 1.2.0
  tags: [presentation, slides, deck, pitch, powerpoint, pptx, keynote, gamma, talk, lecture, webinar, report]
---

# Deck studio

You write; the app designs. A deck is one JSON file in the shared workspace (your working folder,
where your commands start): `decks/<slug>/deck.json`, with pictures in `decks/<slug>/images/`.
Write it there directly (computer_write_file with the path `decks/<slug>/deck.json`); not in the app's
own folder and not anywhere else, because Deck studio reads only `decks/`. There is nothing to look
up first: the folder is created when you write the file. Deck studio turns it into designed slides in the person's chosen theme, lets
them edit any text by clicking it, present full screen, and export an editable PowerPoint, a PDF or a
web page. Never build slides as HTML or a .pptx yourself, and never hand-place anything: choose a
layout and fill its fields.

## 1. The brief (only what changes the deck)

Ask at most three short questions, and only if you cannot guess well: who watches and what they
should do or decide afterwards; how long (5 minutes ≈ 6-8 slides, 15 ≈ 12-15, 30 ≈ 20-25); their
material (notes, a file, numbers, a site, a brand). If they gave a file, read it first. If a brand
exists in `brands/` (made by the Logo designer), use it: `"theme": "brand:<slug>"`.

## 2. The story before the slides

A deck is an argument: a title that promises something, the problem or the question, the answer,
the proof (numbers, a chart, a quote, a case), what it costs or how it works, what happens next, a
closing that asks for one thing. One idea per slide; the title of a content slide says the point,
not the topic ("Revenue tripled since March", not "Revenue"). Short: 3-5 points of under 12 words,
numbers instead of adjectives, real names and figures from their material (never invent figures; mark
a guess in the notes). Speaker notes carry what the person says.

## 3. The file

```json
{
  "title": "Brew Lab - investor pitch",
  "theme": "paper",
  "size": "16:9",
  "footer": "Brew Lab · 2026",
  "slides": [
    { "layout": "title", "kicker": "Seed round 2026", "title": "Coffee, roasted with ==care==", "subtitle": "…", "byline": "Ana Peterson · Founder", "image": "images/cup.jpg", "notes": "…" }
  ]
}
```

Deck fields: `title`, `theme`, `size` ("16:9" or "4:3"), `footer`, `showNumbers` (default true),
`logo` (a picture path; brand themes show the brand's logo by themselves), `showLogo`, `lang`,
`transition` (between slides when presenting, in the web page and in the PowerPoint: `fade` the
default, `slide`, `push`, `zoom`, `rise`, `flip`, `none`; calm decks fade, product and launch decks
push or zoom; one for the deck, and a slide may have its own `transition` for a moment that matters).

Themes: `paper` (warm editorial), `midnight` (dark tech), `aurora` (dark, colourful glow), `swiss`
(white, red, strict grid), `forest` (dark green, gold, serif), `citrus` (bright, playful), `mono`
(black and white, bold), `pastel` (soft, friendly), `corporate` (white and blue), `noir` (black,
champagne, elegant), `ocean` (teal, calm), `brutal` (neo-brutalist stickers); `brand:<slug>` or
`brand:<slug>:dark` for a Logo designer brand. Pick what fits the audience: investors and business
`paper`, `corporate`, `noir`, `swiss`; tech and product `midnight`, `aurora`; education and kids
`pastel`, `citrus`, `ocean`; bold launches `brutal`, `mono`.

Text everywhere takes `**bold**`, `*italic*` and `==highlight==` (in the accent colour; use it on one
or two words of a title, not more). Every slide may have `notes` and `kicker` (a small label above
the title), and `"accent": true` for a full-colour background (use it for one or two slides).
`"hidden": true` keeps a slide in the deck but out of presenting and exports (a backup slide).

| layout | fields |
|---|---|
| `title` | kicker, title, subtitle, byline, image |
| `section` | number, title, subtitle |
| `agenda` | title, items: [text] |
| `bullets` | title, intro, bullets: [text] or [{title, text, icon}] (rich: 2-6 with titles) |
| `split` | title, text, bullets: [text], image (or icon when there is no picture) |
| `cards` | title, intro, cards: [{icon, title, text}] (2-6) |
| `stats` | title, stats: [{value, label, detail}] (2-4), note |
| `chart` | title, chart: {type: bar/line/area/pie/donut, labels, series: [{name, values}], unit ("%", "$k", "$", "users"), stacked, horizontal, center (donut)}, text, points: [text], source |
| `quote` | quote, author, role, image |
| `timeline` | title, steps: [{label, title, text}] (3-6) |
| `process` | title, steps: [{title, text, icon}] (3-5) |
| `compare` | title, columns: [{title, price, text, points: [text], highlight, cons}] (2-4; pricing, options, before and after) |
| `table` | title, head: [...], rows: [[...]], note |
| `team` | title, people: [{name, role, image}] |
| `image` | image (full bleed), kicker, title, caption |
| `statement` | kicker, text, subtitle (one big sentence) |
| `closing` | title, subtitle, cta, contact |

Icons (Lucide names): rocket, target, trending-up, chart-bar, users, heart, star, sparkles, zap,
lightbulb, brain, bot, globe, map-pin, clock, calendar, check, shield-check, lock, key, search,
settings, package, truck, shopping-cart, credit-card, wallet, coins, gift, store, building-2,
briefcase, graduation-cap, book-open, file-text, mail, message-circle, phone, laptop, server,
database, cloud, download, link, share-2, send, megaphone, bell, flag, award, trophy, crown, gem,
leaf, sprout, sun, flame, coffee, utensils, camera, image, video, music, mic, palette, layers,
list-checks, workflow, code, terminal, puzzle, handshake, thumbs-up, smile, activity, gauge, scale,
plane, car, bike, ship, stethoscope, pill, microscope, flask-conical, atom, recycle, battery, wifi,
ticket, party-popper, dumbbell, goal (and most other Lucide icons).

Pictures: put them in `decks/<slug>/images/` and name them as `images/<file>`. Where they come
from, in this order:
1. The person's own (a file they gave or named, their site, their brand in `brands/`).
2. **Free photo sites, always first when you look for one:** Unsplash (unsplash.com), Pexels
   (pexels.com), Pixabay (pixabay.com); for real places, people, buildings and history, Wikimedia
   Commons (commons.wikimedia.org, only files marked public domain or CC BY / CC BY-SA). Search them
   with the slide's subject in English ("coffee roasting", "team meeting office"), open the photo's
   own page, and download the full photo from there (landscape for a picture behind a slide or
   beside it, about 2000 px wide is plenty). Never take pictures from search results, news sites,
   stock sites that need a licence (Shutterstock, Getty, Adobe Stock), or anyone's social media.
3. Make one with an image tool you have, when the free sites have nothing that fits, or the slide
   needs something that cannot be photographed (an idea, an illustration in the deck's colours).
Put where it came from in the slide's `notes` ("Photo: Jane Doe on Unsplash" with the page's link;
Wikimedia: the author and licence). No picture is fine: `split` shows a large icon instead, and the
themes carry their own decoration; one strong photo is better than a weak one on every slide.

Any slide can have one picture, `image`, and you say where it goes with `imagePos`:
- `"right"` or `"left"`: Title, Text and picture and Quote frame it beside the text; every other
  layout (points, cards, numbers, a chart, steps…) gets it as a full-height panel on that side and
  the content moves over. Good for one strong photo next to 3-4 points.
- `"background"`: behind the whole slide under a shade, with the text turned light (`bgTint:
  "light"` for a pale shade and dark text instead); `bgDim` 0-0.9 is how strong the shade is
  (default 0.5). Good for title, section, statement and closing slides, and for a mood; keep the
  text short on them. Section, Statement and Closing put a picture behind by default.
- the `image` layout always fills the slide with it.
Optional: `imageFocus` ("30% 60%", the point of the picture that must stay in view, e.g. a face),
`imageZoom` (1-3), `imageFit: "contain"` to show all of a picture (a screenshot, a diagram). People
take `image` too (`people: [{name, role, image}]`).

The person can also do all of this in Deck studio (drop a picture onto the slide, drag it to move
it, choose Left, Right or Behind). When a message from the app asks for a picture for a slide, find
one on the free photo sites above (or make one when they have nothing) that fits what the slide says, save it into `decks/<slug>/images/`, set `image` (and
`imagePos` if the slide has none), and show the deck again on that slide.

## 4. Show it

Write the file, then `showDeck` with `deck` (the slug) and a one-line `note` (theme, length, anything
you assumed). If the card says there is no such deck, the file is not at `decks/<slug>/deck.json` in
the workspace: move it there and show it again; never say it is on screen when the card says otherwise. Say in one sentence that they can click any text to change it, switch theme or layout
in Deck studio, present, or export PowerPoint, PDF or a web page.

## Changes

Messages from the app start with `[Deck studio · "<title>" (decks/<slug>/deck.json)]`, often with
"Slide N": read the file, change exactly that, keep everything the person edited, write the file,
and show it again with `showDeck` and `slide` (0-based). A new theme or size is one field. Adding
slides: insert them where they belong in the story.
