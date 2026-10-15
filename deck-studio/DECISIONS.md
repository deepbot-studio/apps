# Deck studio: decisions

What this app is, and why it is built this way. For anybody reading the code.

## The shape of it

- **The Bot writes, the app designs.** A deck is `decks/<slug>/deck.json`: slides as a layout and its fields (title, points, cards, stats, a chart's data ...), never positions. 17 layouts and 12 themes (plus every Logo designer brand, light and dark) do the design, so a slide never has to be laid out by a model and a theme change restyles everything.
- **One renderer for everything**: a slide is HTML on a fixed 1920 x 1080 (or 1440 x 1080) canvas, scaled to wherever it is shown (editor, thumbnails, the chat card, presenting) and shrunk to fit when the text is long. Themes are fonts from the bundled catalogue, a palette, the heading style, the background and the decoration.
- **Edit in place**: any text is clicked and typed into; it is saved back to the JSON with its bold, italic and highlight. Layout, theme, size, pictures (upload or the deck's images folder), slide order (drag), notes and chart data are on the side. "Ask the Bot" sends the change with the deck and slide named.
- **Exports, all in the page**: PDF (every slide as a sharp picture, so it looks exactly as here); PowerPoint that stays editable (text boxes where the text is with its font, size and colours, native charts and tables, the background and pictures as images; the theme's fonts are saved next to it, since PowerPoint uses installed fonts); one HTML file that presents itself (arrows, click, F) or scrolls as a one-page site, with fonts and pictures inside.
- **Share link**: the web page goes into Site builder's folder (`sites/<slug>-deck/`), and is published from Sites to the person's Netlify, Vercel or GitHub Pages. No hosting of our own yet.
- A page in a locked frame cannot let html-to-image read stylesheets or fetch pictures across origins, so exports get the theme's fonts as data URLs and every picture read through DeepBot.
- **Not yet**: documents (A4 pages) as a second format, picture search and generation inside the app, comments and a presenter view with the next slide.

## 1.2.0

- **The side panel vanished** below 1100 px (a laptop with DeepBot's sidebar open): Layout, Picture, Theme were gone. It now stays at every width; on a small window the slides become a strip on top and the panel goes under the slide.
- **Thumbnails** were drawn at a fixed 182 px and cut off in a narrower rail: they follow the rail's width now.
- **The folder is the deck**: a `slug` inside deck.json that disagreed with its folder made the deck fail to open. The folder wins.
- **A picture the deck names but its folder lacks** shows a quiet "Picture not found" frame (slide and side panel), and every export leaves a gap instead of failing; the web page gets no broken links.
- **PowerPoint** backgrounds are JPEG: 15 slides went from 8 MB to 1 MB.
- **"Website" export** keeps what Site builder knows (where it is published, the domain) when exported again; before, the next publish made a second site on the host.
- Export results say where the file went (Downloads, the deck's folder, Site builder) in a toast, not "Exported PDF".
- The layout picker stays on screen on a narrow window.
- The sample content is fictional and in English: no real places or people.
- **"Ask the Bot" stays on the page** (DeepBot's "ask-beside"): the conversation opens beside the deck and the editor follows the Bot. When deck.json changes on disk and it is not what the editor wrote, it reloads (not while the person types into the deck; then on leaving the field) and says "The Bot changed the deck." with Undo. A deck the Bot is making appears on the list by itself. Enter sends a line to the Bot. Which deck and slide go as instructions, so the conversation shows the person's own words.
