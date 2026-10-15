/*
 * A DECK IN THE CHAT: the slides, big, with arrows and a strip of thumbnails, and buttons to edit the
 * deck in Deck studio or present it full screen.
 */
import { deckContext, mountSlide, readDeck } from "./lib/deck.js";
import { esc } from "./lib/layouts.js";

let args = {};
let deck = null;
let ctx = null;
let at = 0;

async function render() {
	const root = document.getElementById("root");
	try {
		deck = await readDeck(String(args.deck || ""));
	} catch {
		root.innerHTML = `<div class="note">No deck at decks/${esc(args.deck || "")}/deck.json in the workspace.</div>`;
		return false;
	}
	ctx = await deckContext(deck);
	at = Math.min(Math.max(0, Number(args.slide) || 0), deck.slides.length - 1);
	root.innerHTML = `<div class="hd"><div><div class="tag">Deck studio · ${deck.slides.length} slides</div><div class="ttl">${esc(deck.title)}</div></div></div>
    ${args.note ? `<div class="note">${esc(args.note)}</div>` : ""}
    <div class="main" id="main"><div id="big"></div><button type="button" class="nav l" data-step="-1" aria-label="Previous">‹</button><button type="button" class="nav r" data-step="1" aria-label="Next">›</button></div>
    <div class="strip" id="strip">${deck.slides.map((_, i) => `<div class="mini ${i === at ? "on" : ""}" data-at="${i}"></div>`).join("")}</div>
    <div class="ft"><span class="muted small" id="count"></span><div class="row"><button type="button" class="btn ghost sm" id="present">▶ Present</button><button type="button" class="btn sm" id="edit">Edit in Deck studio</button></div></div>`;
	for (const [i, m] of [...document.querySelectorAll(".mini")].entries())
		mountSlide(m, deck.slides[i], ctx, i, { scale: 116 / ctx.size[0] });
	show();
	return true;
}

function show() {
	const big = document.getElementById("big");
	const main = document.getElementById("main");
	if (!big || !main || !ctx) return; // still opening
	const w = main.clientWidth;
	mountSlide(big, deck.slides[at], ctx, at, { scale: w / ctx.size[0] });
	for (const [i, m] of [...document.querySelectorAll(".mini")].entries())
		m.classList.toggle("on", i === at);
	document.getElementById("count").textContent =
		`${at + 1} / ${deck.slides.length}`;
}

document.addEventListener("click", (e) => {
	if (!deck) return;
	const step = e.target.closest("[data-step]")?.dataset.step;
	const mini = e.target.closest("[data-at]")?.dataset.at;
	if (step) {
		at = Math.min(deck.slides.length - 1, Math.max(0, at + Number(step)));
		show();
	} else if (mini !== undefined) {
		at = Number(mini);
		show();
	} else if (e.target.closest("#edit"))
		deepbot.openPage("decks", { deck: deck.slug, slide: at });
	else if (e.target.closest("#present"))
		deepbot.openPage("decks", { deck: deck.slug, slide: at, present: true });
	else if (e.target.closest("#main")) {
		at = Math.min(deck.slides.length - 1, at + 1);
		show();
	}
});

addEventListener("resize", () => deck && show());
if (window.deepbot) {
	deepbot.ready.then(async (init) => {
		args = init.args || {};
		if (await render()) deepbot.done();
		else
			deepbot.fail(
				`No deck at decks/${args.deck || ""}/deck.json in the shared workspace. Write the file there (relative to your working folder) and show it again.`,
			);
	});
	deepbot.on("display", () => setTimeout(() => deck && show(), 80));
	let t = null;
	deepbot.on("args", (n) => {
		args = n || {};
		clearTimeout(t);
		t = setTimeout(render, 400);
	});
}
