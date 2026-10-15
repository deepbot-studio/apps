/*
 * DECK STUDIO: every deck in the workspace, and the editor: slides on the left, the slide in the
 * middle (click any text and type; drop, paste or drag a picture onto it; hover a card, point or step
 * to move, copy or remove it), and on the right the slide (layout, picture, content, background,
 * transition) and the deck (theme, size, footer). Right-click a slide for everything you can do with
 * it; Ctrl+Z undoes. Present full screen with transitions, export to PDF, PowerPoint or a web page,
 * publish through Sites, and ask the Bot to rewrite a slide or find it a picture. Every change is
 * saved to decks/<slug>/deck.json as it is made.
 */

import {
	deckContext,
	ensureFonts,
	fontCatalogue,
	listBrands,
	listDecks,
	mountSlide,
	newId,
	normaliseDeck,
	ROOT,
	readDeck,
	saveDeck,
	changedOnDisk,
	slugify,
	THEMES,
} from "./lib/deck.js";
import { toHtml, toPdf, toPptx, toSite } from "./lib/export.js";
import { blobToBase64, download } from "./lib/files.js";
import { ICONS, icon } from "./lib/icons.js";
import {
	esc,
	htmlToMd,
	LAYOUTS,
	picPlacement,
	setPath,
} from "./lib/layouts.js";
import { brandTheme } from "./lib/themes.js";
import { play, TRANSITIONS, transitionOf } from "./lib/transitions.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = () => $("#root");
const ui = {
	deck: null,
	ctx: null,
	at: 0,
	brands: [],
	images: [],
	tab: "slide",
	past: [],
	future: [],
	clip: null,
};

/* -------------------------------------------------------------------------- templates */

const LISTS = {
	bullets: ["bullets", () => "A new point"],
	agenda: ["items", () => "A new part"],
	split: ["bullets", () => "A new point"],
	cards: [
		"cards",
		() => ({
			icon: "sparkles",
			title: "Title",
			text: "One or two lines about it.",
		}),
	],
	stats: ["stats", () => ({ value: "42%", label: "What it measures" })],
	chart: ["points", () => "A point about the chart"],
	timeline: [
		"steps",
		() => ({ label: "Next", title: "Milestone", text: "What happens." }),
	],
	process: ["steps", () => ({ title: "Step", text: "What happens here." })],
	compare: ["columns", () => ({ title: "Option", points: ["A point"] })],
	team: ["people", () => ({ name: "Name Surname", role: "Role" })],
	table: ["rows", (s) => (s.head || s.rows?.[0] || ["", ""]).map(() => "")],
};

const NOUN = {
	bullets: "points",
	split: "points",
	agenda: "parts",
	cards: "cards",
	stats: "numbers",
	chart: "points beside the chart",
	timeline: "milestones",
	process: "steps",
	compare: "columns",
	team: "people",
	table: "rows",
};

const BLANK = {
	title: () => ({
		kicker: "Kicker",
		title: "The title of the deck",
		subtitle: "One line on what it is and for whom",
	}),
	section: (i) => ({
		number: i,
		title: "A new part",
		subtitle: "What it covers",
	}),
	agenda: () => ({
		title: "Agenda",
		items: ["Where we are", "What we propose", "What it costs", "Next steps"],
	}),
	bullets: () => ({
		title: "The point of this slide",
		bullets: ["First point", "Second point", "Third point"],
	}),
	split: () => ({
		title: "Text and a picture",
		text: "A short paragraph that says one thing well.",
		icon: "lightbulb",
	}),
	cards: () => ({
		title: "Three things",
		cards: [LISTS.cards[1](), LISTS.cards[1](), LISTS.cards[1]()],
	}),
	stats: () => ({
		title: "In numbers",
		stats: [
			{ value: "3x", label: "Faster" },
			{ value: "40%", label: "Cheaper" },
			{ value: "12k", label: "Users" },
		],
	}),
	chart: () => ({
		title: "How it grows",
		chart: {
			type: "bar",
			labels: ["Q1", "Q2", "Q3", "Q4"],
			series: [{ name: "Revenue", values: [12, 19, 27, 41] }],
			unit: "k",
		},
		text: "What the chart shows, in one sentence.",
	}),
	quote: () => ({
		quote: "A sentence someone said that makes the point for you.",
		author: "Name Surname",
		role: "Role, Company",
	}),
	timeline: () => ({
		title: "Timeline",
		steps: [
			{ label: "Jan", title: "Start" },
			{ label: "Mar", title: "Beta" },
			{ label: "Jun", title: "Launch" },
		],
	}),
	process: () => ({
		title: "How it works",
		steps: [
			{ title: "Ask", icon: "message-circle" },
			{ title: "Plan", icon: "list-checks" },
			{ title: "Done", icon: "check" },
		],
	}),
	compare: () => ({
		title: "Choose",
		columns: [
			{ title: "Basic", price: "$9", points: ["One thing"] },
			{ title: "Pro", price: "$29", points: ["Everything"], highlight: true },
		],
	}),
	table: () => ({
		title: "Table",
		head: ["", "Us", "Them"],
		rows: [
			["Price", "$9", "$19"],
			["Speed", "Fast", "Slow"],
		],
	}),
	team: () => ({
		title: "The team",
		people: [
			{ name: "Alex Morgan", role: "CEO" },
			{ name: "Sam Rivera", role: "CTO" },
		],
	}),
	image: () => ({
		title: "A picture says it",
		caption: "Drop a picture on this slide",
	}),
	statement: () => ({ text: "One sentence that ==matters==." }),
	closing: () => ({
		title: "Thank you",
		subtitle: "Questions?",
		cta: "Get started",
	}),
};

/* -------------------------------------------------------------------------- small pieces */

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

function getPath(obj, path) {
	return String(path)
		.split(".")
		.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function popover(html, { x, y, anchor, cls = "" } = {}) {
	closePopovers();
	const m = document.createElement("div");
	m.className = `menu pop ${cls}`;
	m.innerHTML = html;
	document.body.appendChild(m);
	let left = x;
	let top = y;
	if (anchor) {
		const r = anchor.getBoundingClientRect();
		left = r.left;
		top = r.bottom + 6;
	}
	const w = m.offsetWidth;
	const h = m.offsetHeight;
	m.style.left = `${Math.max(8, Math.min(left, innerWidth - w - 8))}px`;
	m.style.top = `${Math.max(8, Math.min(top, innerHeight - h - 8))}px`;
	setTimeout(() => {
		const away = (e) => {
			if (!m.contains(e.target)) {
				m.remove();
				removeEventListener("mousedown", away, true);
			}
		};
		addEventListener("mousedown", away, true);
	}, 0);
	return m;
}
function closePopovers() {
	for (const m of $$(".menu.pop")) m.remove();
}

/** A menu of actions: [{label, kbd, run, danger, disabled}] or "-" for a line. */
function actionMenu(items, at) {
	const m = popover(
		items
			.map((it, i) =>
				it === "-"
					? '<div class="sep"></div>'
					: `<button type="button" data-mi="${i}" ${it.disabled ? "disabled" : ""} class="${it.danger ? "danger" : ""}"><span>${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ""}</button>`,
			)
			.join(""),
		at,
	);
	m.addEventListener("click", (e) => {
		const b = e.target.closest("[data-mi]");
		if (!b) return;
		m.remove();
		items[Number(b.dataset.mi)].run();
	});
	return m;
}

let toastTimer = null;
function toast(text, { undo = false } = {}) {
	$("#toast")?.remove();
	const t = document.createElement("div");
	t.id = "toast";
	t.className = "toast";
	t.innerHTML = `<span>${esc(text)}</span>${undo ? `<button type="button" data-undo>Undo</button>` : ""}`;
	document.body.appendChild(t);
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => t.remove(), Math.max(4200, text.length * 55));
}

/* -------------------------------------------------------------------------- library */

async function library() {
	ui.deck = null;
	hideBars();
	const decks = await listDecks();
	ui.libSig = libSig(decks);
	const draft = $("#about")?.value || "";
	root().innerHTML = `<div class="wrap">
    <div class="row" style="justify-content:space-between"><div><h1 class="t">Deck studio</h1><div class="muted">Presentations from a sentence, a text or a file. Click a deck to edit it; right-click for more.</div></div></div>
    <div class="sec">Decks</div>
    <div class="lib">${decks.map((d) => `<div class="dk" data-open="${esc(d.slug)}" tabindex="0"><div class="th" data-thumb="${esc(d.slug)}"></div><div class="cap"><div><b>${esc(d.title)}</b><span class="muted small">${d.slides.length} slides · ${esc(String(d.theme).startsWith("brand:") ? "brand" : THEMES.find((t) => t.id === d.theme)?.name || d.theme)}</span></div><button type="button" class="more" data-deckmenu="${esc(d.slug)}" title="More" aria-label="More">⋯</button></div></div>`).join("")}
      <div class="new"><b>A new deck</b><textarea class="in" id="about" rows="4" placeholder="What is it about, for whom, how long? Paste notes or name a file."></textarea>
        <div class="row"><button type="button" class="btn" data-make>Ask the Bot to make it</button><button type="button" class="btn ghost" data-blank>Start blank</button></div></div></div></div>`;
	ui.decks = decks;
	if (draft) $("#about").value = draft;
	for (const d of decks) {
		const host = $(`[data-thumb="${CSS.escape(d.slug)}"]`);
		if (!host) continue;
		const ctx = await deckContext(d);
		mountSlide(host, d.slides[0], ctx, 0);
	}
}

function deckMenu(slug, at) {
	const d = ui.decks?.find((x) => x.slug === slug);
	if (!d) return;
	actionMenu(
		[
			{ label: "Open", run: () => openDeck(slug) },
			{ label: "Present", run: () => openDeck(slug).then(() => present(0)) },
			{
				label: "Rename",
				run: () => {
					const cap = $(`[data-open="${CSS.escape(slug)}"] .cap b`);
					if (!cap) return;
					cap.innerHTML = `<input class="in" id="rename" value="${esc(d.title)}">`;
					const input = $("#rename");
					input.focus();
					input.select();
					const done = async (save) => {
						if (save && input.value.trim()) {
							const full = await readDeck(slug);
							full.title = input.value.trim();
							await saveDeck(full);
						}
						library();
					};
					input.addEventListener("keydown", (e) => {
						if (e.key === "Enter") done(true);
						if (e.key === "Escape") done(false);
						e.stopPropagation();
					});
					input.addEventListener("blur", () => done(true));
					input.addEventListener("click", (e) => e.stopPropagation());
				},
			},
			{ label: "Duplicate", run: () => duplicateDeck(slug) },
			"-",
			{
				label: "Delete…",
				danger: true,
				run: () => {
					const m = popover(
						`<div class="confirm"><b>Delete "${esc(d.title)}"?</b><div class="muted small">The deck, its pictures and the files exported from it go. This cannot be undone.</div><div class="row"><button type="button" class="btn sm danger" data-yes>Delete</button><button type="button" class="btn ghost sm" data-no>Cancel</button></div></div>`,
						at,
					);
					m.addEventListener("click", async (e) => {
						if (e.target.closest("[data-no]")) return m.remove();
						if (!e.target.closest("[data-yes]")) return;
						m.remove();
						await deepbot.files.delete(`${ROOT}/${slug}`);
						library();
					});
				},
			},
		],
		at,
	);
}

async function copyFolder(from, to) {
	const r = await deepbot.files.list(from).catch(() => ({ items: [] }));
	for (const it of r.items || []) {
		if (it.dir) await copyFolder(it.path, `${to}/${it.name}`);
		else
			await deepbot.files.write(
				`${to}/${it.name}`,
				await deepbot.files.read(it.path, "base64"),
				{ encoding: "base64" },
			);
	}
}

async function duplicateDeck(slug) {
	const d = await readDeck(slug);
	const copy = `${slugify(d.title)}-${Date.now().toString(36).slice(-4)}`;
	toast("Copying…");
	await copyFolder(`${ROOT}/${slug}/images`, `${ROOT}/${copy}/images`);
	await saveDeck({ ...d, slug: copy, title: `${d.title} (copy)` });
	toast("Deck copied");
	library();
}

/* -------------------------------------------------------------------------- editor */

async function openDeck(slug, at = 0) {
	ui.deck = await readDeck(slug);
	await changedOnDisk(slug); // what is on disk now is the starting point for following the Bot
	ui.at = Math.max(0, Math.min(at, ui.deck.slides.length - 1));
	ui.past = [];
	ui.future = [];
	ui.brands = await listBrands();
	await loadImages();
	await rebuild();
}

async function loadImages() {
	const r = await deepbot.files
		.list(`${ROOT}/${ui.deck.slug}/images`)
		.catch(() => ({ items: [] }));
	ui.images = (r.items || [])
		.filter((i) => /\.(png|jpe?g|webp|gif|svg)$/i.test(i.name))
		.sort((a, b) => (b.modified || 0) - (a.modified || 0))
		.map((i) => `images/${i.name}`);
}

async function rebuild() {
	ui.ctx = await deckContext(ui.deck, { editable: true });
	const d = ui.deck;
	root().innerHTML = `<div class="ed">
    <div class="top"><button type="button" class="btn ghost sm" data-home>← Decks</button>
      <input class="title" id="dtitle" value="${esc(d.title)}">
      <span class="status" id="status"></span>
      <button type="button" class="icon-btn" data-undo title="Undo (${MOD}+Z)" aria-label="Undo">↶</button><button type="button" class="icon-btn" data-redo title="Redo (${MOD}+Shift+Z)" aria-label="Redo">↷</button>
      <button type="button" class="btn ghost sm" data-ask-deck>Ask the Bot</button>
      <button type="button" class="btn ghost sm" data-export>Export ▾</button>
      <button type="button" class="btn sm" data-present title="Present (F5)">▶ Present</button></div>
    <div class="work"><div class="rail" id="rail" tabindex="0"></div>
      <div class="stage" id="stage"><div class="canvas" id="canvas"></div><div class="drop" id="drop" hidden></div><textarea class="in notes" id="notes" rows="3" placeholder="Speaker notes (only you see them when presenting: press N)"></textarea></div>
      <div class="side" id="side"></div></div></div>`;
	drawRail();
	drawCanvas();
	drawSide();
	updateUndo();
}

/** A thumbnail's scale: as wide as the rail draws it (narrower rails, the strip on a small window). */
const thumbScale = () =>
	($("#rail .thumb")?.clientWidth || 182) / ui.ctx.size[0];

function drawRail() {
	const rail = $("#rail");
	if (!rail) return;
	rail.innerHTML = `${ui.deck.slides.map((s, i) => `<div class="thumb ${i === ui.at ? "on" : ""} ${s.hidden ? "hid" : ""}" draggable="true" data-go="${i}"><span class="n">${i + 1}</span>${s.hidden ? '<span class="eye" title="Hidden: skipped when presenting and exporting">hidden</span>' : ""}<div class="h"></div></div>`).join("")}<div class="addbar"><button type="button" class="btn ghost sm" data-add>+ Slide</button></div>`;
	$$(".thumb", rail).forEach((t, i) => {
		mountSlide(
			t.querySelector(".h"),
			ui.deck.slides[i],
			{ ...ui.ctx, editable: false },
			i,
			{ scale: thumbScale() },
		);
	});
	$("#rail .thumb.on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function redrawThumb(i) {
	const t = $(`#rail .thumb[data-go="${i}"] .h`);
	if (t)
		mountSlide(t, ui.deck.slides[i], { ...ui.ctx, editable: false }, i, {
			scale: thumbScale(),
		});
}

function drawCanvas() {
	const host = $("#canvas");
	if (!host) return;
	hideBars();
	const slide = ui.deck.slides[ui.at];
	const W = ui.ctx.size[0];
	const H = ui.ctx.size[1];
	const stage = host.parentElement;
	const width = Math.max(
		320,
		Math.min(
			stage.clientWidth - 56,
			1200,
			((stage.clientHeight - 140) * W) / H,
		),
	);
	host.style.width = `${width}px`;
	const el = mountSlide(host, slide, ui.ctx, ui.at, { scale: width / W });
	el.addEventListener("input", (e) => {
		const k = e.target.closest("[data-k]")?.dataset.k;
		if (!k) return;
		setPath(slide, k, htmlToMd(e.target.closest("[data-k]").innerHTML));
		queueSave(ui.at);
	});
	el.addEventListener("paste", (e) => {
		if (
			[...(e.clipboardData?.items || [])].some((i) =>
				i.type.startsWith("image/"),
			)
		)
			return; // a picture: the document handler puts it on the slide
		// plain text only: formatting from elsewhere would not survive the save anyway
		e.preventDefault();
		document.execCommand(
			"insertText",
			false,
			e.clipboardData.getData("text/plain"),
		);
	});
	el.addEventListener("keydown", (e) => {
		const k = e.key.toLowerCase();
		if ((e.ctrlKey || e.metaKey) && (k === "b" || k === "i")) {
			e.preventDefault();
			document.execCommand(k === "b" ? "bold" : "italic");
		}
		if (e.key === "Escape") e.target.blur();
	});
	el.addEventListener("focusin", () => remember());
	$("#notes").value = slide.notes || "";
}

/* -------------------------------------------------------------------------- history */

function snapshot() {
	return JSON.stringify(ui.deck);
}
/** Call before a change: it can be undone. */
function remember() {
	const s = snapshot();
	if (ui.past.at(-1) === s) return;
	ui.past.push(s);
	if (ui.past.length > 120) ui.past.shift();
	ui.future = [];
	updateUndo();
}
async function travel(from, to) {
	if (!from.length) return;
	to.push(snapshot());
	const before = ui.deck;
	ui.deck = JSON.parse(from.pop());
	ui.at = Math.min(ui.at, ui.deck.slides.length - 1);
	queueSave();
	if (before.theme !== ui.deck.theme || before.size !== ui.deck.size)
		await rebuild();
	else {
		drawRail();
		drawCanvas();
		drawSide();
	}
	updateUndo();
}
const undo = () => travel(ui.past, ui.future);
const redo = () => travel(ui.future, ui.past);
function updateUndo() {
	const u = $("[data-undo].icon-btn");
	const r = $("[data-redo]");
	if (u) u.disabled = !ui.past.length;
	if (r) r.disabled = !ui.future.length;
}

/** Change the deck: remembered for undo, saved, and drawn again. */
function change(fn, { rail = false, side = true, canvas = true } = {}) {
	remember();
	fn(ui.deck.slides[ui.at], ui.deck);
	queueSave(rail ? null : ui.at);
	if (rail) drawRail();
	if (canvas) drawCanvas();
	if (side) drawSide();
}

let saveTimer = null;
function queueSave(slideIndex = null) {
	clearTimeout(saveTimer);
	setStatus("Saving…");
	saveTimer = setTimeout(async () => {
		saveTimer = null;
		try {
			await saveDeck(ui.deck);
			setStatus("Saved");
		} catch (error) {
			setStatus(`Not saved: ${error.message}`);
		}
		if (slideIndex !== null) redrawThumb(slideIndex);
	}, 450);
}
function setStatus(s) {
	const el = $("#status");
	if (el) el.textContent = s;
}

/* -------------------------------------------------------------------------- slide actions */

function go(i) {
	if (!ui.deck) return;
	ui.at = Math.max(0, Math.min(ui.deck.slides.length - 1, i));
	for (const t of $$("#rail .thumb"))
		t.classList.toggle("on", Number(t.dataset.go) === ui.at);
	$("#rail .thumb.on")?.scrollIntoView({ block: "nearest" });
	drawCanvas();
	drawSide();
}

function insertSlide(slide, at = ui.at + 1) {
	change(
		(_, d) => {
			d.slides.splice(at, 0, { ...slide, id: newId() });
			ui.at = at;
		},
		{ rail: true },
	);
}

function newSlide(layout, at = ui.at + 1) {
	const n =
		ui.deck.slides.slice(0, at).filter((s) => s.layout === "section").length +
		1;
	insertSlide({ layout, ...BLANK[layout](n) }, at);
}

function duplicateSlide(i = ui.at) {
	insertSlide(structuredClone(ui.deck.slides[i]), i + 1);
}

function deleteSlide(i = ui.at) {
	if (ui.deck.slides.length <= 1)
		return toast("A deck keeps at least one slide");
	change(
		(_, d) => {
			d.slides.splice(i, 1);
			ui.at = Math.min(i, d.slides.length - 1);
		},
		{ rail: true },
	);
	toast("Slide deleted", { undo: true });
}

function moveSlide(i, to) {
	if (to < 0 || to >= ui.deck.slides.length || to === i) return;
	change(
		(_, d) => {
			const [s] = d.slides.splice(i, 1);
			d.slides.splice(to, 0, s);
			ui.at = to;
		},
		{ rail: true },
	);
}

function toggleHidden(i = ui.at) {
	change(
		(_, d) => {
			const s = d.slides[i];
			s.hidden = !s.hidden;
			if (!s.hidden) delete s.hidden;
		},
		{ rail: true },
	);
}

function setLayout(layout, i = ui.at) {
	change(
		(_, d) => {
			const s = d.slides[i];
			// keep what fits: the title, the picture and its settings, notes; the rest from the new
			// layout's example where empty, and points carried over as cards, steps and so on
			const fresh = BLANK[layout](1);
			const keep = {};
			for (const k of [
				"title",
				"kicker",
				"image",
				"imagePos",
				"imageFocus",
				"imageZoom",
				"imageFit",
				"bgDim",
				"bgTint",
				"notes",
				"hidden",
				"transition",
				"accent",
			])
				if (s[k] !== undefined && s[k] !== "") keep[k] = s[k];
			d.slides[i] = {
				id: s.id,
				layout,
				...fresh,
				...keep,
				...carry(s, layout),
			};
			ui.at = i;
		},
		{ rail: true },
	);
}

function copySlide(i = ui.at) {
	ui.clip = structuredClone(ui.deck.slides[i]);
	toast("Slide copied");
}
function pasteSlide() {
	if (!ui.clip) return;
	insertSlide(structuredClone(ui.clip));
}

function slideMenu(i, at) {
	const s = ui.deck.slides[i];
	const n = ui.deck.slides.length;
	actionMenu(
		[
			{
				label: "New slide after",
				kbd: `${MOD}+M`,
				run: () => layoutPicker("new", at, i + 1),
			},
			{ label: "Duplicate", kbd: `${MOD}+D`, run: () => duplicateSlide(i) },
			{ label: "Copy", kbd: `${MOD}+C`, run: () => copySlide(i) },
			{
				label: "Paste after",
				kbd: `${MOD}+V`,
				disabled: !ui.clip,
				run: () => {
					ui.at = i;
					pasteSlide();
				},
			},
			"-",
			{ label: "Change layout…", run: () => layoutPicker("change", at, i) },
			{
				label: s.image ? "Replace picture…" : "Add picture…",
				run: () => {
					ui.at = i;
					choosePicture("image");
				},
			},
			{
				label: "Find a picture with the Bot",
				run: () => {
					ui.at = i;
					askPicture();
				},
			},
			...(s.image
				? [
						{
							label: "Remove picture",
							run: () => {
								ui.at = i;
								removePicture("image");
							},
						},
					]
				: []),
			{
				label: s.accent ? "Theme background" : "Colour background",
				run: () =>
					change(
						(_, d) => {
							const x = d.slides[i];
							x.accent = !x.accent;
							if (!x.accent) delete x.accent;
						},
						{ rail: true },
					),
			},
			"-",
			{
				label: s.hidden ? "Show slide" : "Hide slide",
				run: () => toggleHidden(i),
			},
			{
				label: "Move up",
				kbd: `${MOD}+↑`,
				disabled: i === 0,
				run: () => moveSlide(i, i - 1),
			},
			{
				label: "Move down",
				kbd: `${MOD}+↓`,
				disabled: i === n - 1,
				run: () => moveSlide(i, i + 1),
			},
			{ label: "Move to start", disabled: i === 0, run: () => moveSlide(i, 0) },
			{
				label: "Move to end",
				disabled: i === n - 1,
				run: () => moveSlide(i, n - 1),
			},
			"-",
			{ label: "Present from here", kbd: "F5", run: () => present(i) },
			{
				label: "Ask the Bot about this slide…",
				run: () => {
					go(i);
					ui.tab = "slide";
					drawSide();
					$("#askslide")?.focus();
				},
			},
			"-",
			{
				label: "Delete slide",
				kbd: "Del",
				danger: true,
				disabled: n <= 1,
				run: () => deleteSlide(i),
			},
		],
		at,
	);
}

/** A grid of every layout drawn in the deck's theme: pick one for a new slide or for this one. */
function layoutPicker(mode, at, index) {
	const m = popover(
		`<div class="lp-h">${mode === "new" ? "New slide" : "Layout"}</div><div class="lp">${Object.entries(
			LAYOUTS,
		)
			.map(
				([k, v]) =>
					`<button type="button" data-pick="${k}" class="${mode === "change" && ui.deck.slides[index]?.layout === k ? "on" : ""}"><div class="lp-t" data-lp="${k}"></div><span>${v.name}</span></button>`,
			)
			.join("")}</div>`,
		{ ...at, cls: "wide" },
	);
	for (const host of $$("[data-lp]", m)) {
		const k = host.dataset.lp;
		mountSlide(
			host,
			{ layout: k, ...BLANK[k](1) },
			{ ...ui.ctx, editable: false, showNumbers: false, footer: "" },
			0,
			{ scale: (host.clientWidth || 150) / ui.ctx.size[0] },
		);
	}
	// keep it on screen now that it has its size
	const r = m.getBoundingClientRect();
	if (r.bottom > innerHeight - 8)
		m.style.top = `${Math.max(8, innerHeight - r.height - 8)}px`;
	if (r.right > innerWidth - 8)
		m.style.left = `${Math.max(8, innerWidth - r.width - 8)}px`;
	m.addEventListener("click", (e) => {
		const k = e.target.closest("[data-pick]")?.dataset.pick;
		if (!k) return;
		m.remove();
		if (mode === "new") newSlide(k, index);
		else setLayout(k, index);
	});
}

/* -------------------------------------------------------------------------- items on the slide */

/*
 * Hovering a point, card, number, step, column, person or table row shows a small bar over it:
 * move it earlier or later, copy it, change its icon, remove it. Paths are the slide's own
 * ("cards.1", "columns.0.points.2").
 */
let barItem = null;
let barTimer = null;

function hideBars() {
	$("#itembar")?.remove();
	$("#picbar")?.remove();
	$("#textbar")?.remove();
	barItem = null;
}

function listOf(path) {
	const parts = path.split(".");
	const index = Number(parts.pop());
	return {
		list: getPath(ui.deck.slides[ui.at], parts.join(".")),
		index,
		parent: parts.join("."),
	};
}

function itemAction(path, act) {
	const { parent, index } = listOf(path);
	change((s) => {
		const list = getPath(s, parent);
		if (!Array.isArray(list)) return;
		if (act === "del") list.splice(index, 1);
		else if (act === "dup")
			list.splice(index + 1, 0, structuredClone(list[index]));
		else if (act === "prev" && index > 0)
			[list[index - 1], list[index]] = [list[index], list[index - 1]];
		else if (act === "next" && index < list.length - 1)
			[list[index + 1], list[index]] = [list[index], list[index + 1]];
		else if (act === "hi") {
			// compare: the column to stand out
			for (const [j, c] of list.entries())
				if (c && typeof c === "object")
					c.highlight = j === index ? !c.highlight : false;
		}
	});
}

function showItemBar(target) {
	const path = target.dataset.item;
	if (!path) return;
	barItem = target;
	let bar = $("#itembar");
	if (!bar) {
		bar = document.createElement("div");
		bar.id = "itembar";
		bar.className = "floatbar";
		document.body.appendChild(bar);
		bar.addEventListener("mouseenter", () => clearTimeout(barTimer));
		bar.addEventListener("mouseleave", () => scheduleHide());
		bar.addEventListener("mousedown", (e) => e.preventDefault());
		bar.addEventListener("click", (e) => {
			const b = e.target.closest("[data-ia]");
			if (!b) return;
			const p = bar.dataset.path;
			if (b.dataset.ia === "icon") return iconPicker(`${p}.icon`, b);
			itemAction(p, b.dataset.ia);
		});
	}
	const { list, index } = listOf(path);
	const horizontal = !/^(bullets|items|points|rows)$|\.points$/.test(
		listOf(path).parent,
	);
	const item = list?.[index];
	const canIcon =
		item &&
		typeof item === "object" &&
		/^(cards|steps|bullets)$/.test(listOf(path).parent);
	const isCol = /^columns$/.test(listOf(path).parent);
	bar.dataset.path = path;
	bar.innerHTML = `<button type="button" data-ia="prev" title="Move ${horizontal ? "left" : "up"}" ${index === 0 ? "disabled" : ""}>${horizontal ? "←" : "↑"}</button><button type="button" data-ia="next" title="Move ${horizontal ? "right" : "down"}" ${index >= (list?.length || 1) - 1 ? "disabled" : ""}>${horizontal ? "→" : "↓"}</button>${canIcon ? `<button type="button" data-ia="icon" title="Icon">${icon("sparkles", { size: 15, stroke: 2, colour: "currentColor" })}</button>` : ""}${isCol ? `<button type="button" data-ia="hi" title="Make it stand out">★</button>` : ""}<button type="button" data-ia="dup" title="Copy it">⧉</button><button type="button" data-ia="del" title="Remove" class="danger">✕</button>`;
	const r = target.getBoundingClientRect();
	bar.style.left = `${Math.max(6, r.right - bar.offsetWidth)}px`;
	bar.style.top = `${Math.max(6, r.top - bar.offsetHeight - 4)}px`;
	clearTimeout(barTimer);
}

function scheduleHide() {
	clearTimeout(barTimer);
	barTimer = setTimeout(() => {
		$("#itembar")?.remove();
		barItem = null;
	}, 350);
}

function iconPicker(path, anchor) {
	const names = Object.keys(ICONS);
	const m = popover(
		`<input class="in" id="iconq" placeholder="Search icons"><div class="icons" id="iconlist"></div><div class="row"><button type="button" class="btn ghost sm" data-noicon>No icon</button></div>`,
		{ anchor, cls: "iconpop" },
	);
	const draw = (q = "") => {
		$("#iconlist", m).innerHTML = names
			.filter((n) => n.includes(q.toLowerCase().trim()))
			.map(
				(n) =>
					`<button type="button" data-ic="${n}" title="${n}">${icon(n, { size: 22, stroke: 1.8, colour: "currentColor" })}</button>`,
			)
			.join("");
	};
	draw();
	$("#iconq", m).addEventListener("input", (e) => draw(e.target.value));
	$("#iconq", m).focus();
	m.addEventListener("click", (e) => {
		const ic = e.target.closest("[data-ic]")?.dataset.ic;
		const none = e.target.closest("[data-noicon]");
		if (!ic && !none) return;
		m.remove();
		change((s) => {
			const parts = path.split(".");
			const key = parts.pop();
			const parent = parts.length ? getPath(s, parts.join(".")) : s;
			if (!parent || typeof parent !== "object") return;
			if (none) delete parent[key];
			else parent[key] = ic;
		});
	});
}

/* -------------------------------------------------------------------------- pictures */

/** Big photos are made smaller before they go into the deck (a slide is 1920 wide). */
async function shrink(file) {
	if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.2e6)
		return file;
	try {
		const bmp = await createImageBitmap(file);
		const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
		const c = document.createElement("canvas");
		c.width = Math.round(bmp.width * k);
		c.height = Math.round(bmp.height * k);
		c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
		const type = file.type === "image/png" ? "image/png" : "image/jpeg";
		const blob = await new Promise((r) => c.toBlob(r, type, 0.88));
		return blob && blob.size < file.size ? blob : file;
	} catch {
		return file;
	}
}

async function uploadPicture(file) {
	const ext =
		{
			"image/jpeg": "jpg",
			"image/png": "png",
			"image/webp": "webp",
			"image/gif": "gif",
			"image/svg+xml": "svg",
		}[file.type] || (file.name?.split(".").pop() || "png").toLowerCase();
	const base = (file.name || "picture")
		.replace(/\.[^.]+$/, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.toLowerCase()
		.slice(0, 40);
	const name = `${Date.now().toString(36)}-${base || "picture"}.${ext}`;
	setStatus("Adding the picture…");
	const blob = await shrink(file);
	await deepbot.files.write(
		`${ROOT}/${ui.deck.slug}/images/${name}`,
		await blobToBase64(blob),
		{ encoding: "base64" },
	);
	await loadImages();
	return `images/${name}`;
}

/** Put a picture on the slide: `key` is "image" (the slide's own) or a person's ("people.0.image"). */
function setPicture(path, key = "image", pos = null) {
	change((s) => {
		if (key === "image") {
			const keepPlace = s.image && !pos;
			s.image = path;
			if (pos) s.imagePos = pos;
			if (!keepPlace) {
				delete s.imageFocus;
				delete s.imageZoom;
			}
			if (pos && pos !== "background") delete s.bgDim;
		} else setPath(s, key, path);
	});
}

function removePicture(key = "image") {
	change((s) => {
		if (key === "image") {
			for (const k of [
				"image",
				"imagePos",
				"imageFocus",
				"imageZoom",
				"imageFit",
				"bgDim",
				"bgTint",
				"side",
			])
				delete s[k];
		} else {
			const parts = key.split(".");
			const last = parts.pop();
			const parent = getPath(s, parts.join("."));
			if (parent) delete parent[last];
		}
	});
}

let pickKey = "image";
function choosePicture(key = "image") {
	pickKey = key;
	$("#picfile")?.remove();
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "image/*";
	input.id = "picfile";
	input.hidden = true;
	document.body.appendChild(input);
	input.addEventListener("change", async () => {
		const f = input.files?.[0];
		input.remove();
		if (!f) return;
		setPicture(await uploadPicture(f), pickKey);
	});
	input.click();
}

function askPicture(what = "") {
	const s = ui.deck.slides[ui.at];
	const about = s.title || s.text || s.quote || s.layout;
	ask(
		`${where()} Slide ${ui.at + 1} ("${htmlToMd(String(about)).slice(0, 80)}") needs a picture${what ? `: ${what}` : ""}. Find a fitting photo on Unsplash, Pexels, Pixabay or Wikimedia Commons (free licence; make one only if they have nothing), credit it in the slide's notes, save it into ${ROOT}/${ui.deck.slug}/images/ and set the slide's "image"${s.imagePos ? "" : ' and "imagePos" (left, right or background)'} in deck.json, then show the deck again.`,
	);
	setStatus("Asked the Bot for a picture");
}

function picBar(target) {
	const key = target.dataset.pic;
	const s = ui.deck.slides[ui.at];
	const empty = target.dataset.empty === "1" || !getPath(s, key);
	let bar = $("#picbar");
	if (!bar) {
		bar = document.createElement("div");
		bar.id = "picbar";
		bar.className = "floatbar";
		document.body.appendChild(bar);
		bar.addEventListener("mouseenter", () => clearTimeout(picTimer));
		bar.addEventListener("mouseleave", () => hidePicBar());
		bar.addEventListener("click", (e) => {
			const b = e.target.closest("[data-pa]");
			if (!b) return;
			const k = bar.dataset.key;
			const a = b.dataset.pa;
			if (a === "replace") choosePicture(k);
			else if (a === "bot") askPicture();
			else if (a === "remove") removePicture(k);
			else if (a === "zin" || a === "zout")
				change((x) => {
					const z = Math.min(
						3,
						Math.max(
							1,
							(Number(x.imageZoom) || 1) + (a === "zin" ? 0.15 : -0.15),
						),
					);
					if (z === 1) delete x.imageZoom;
					else x.imageZoom = Math.round(z * 100) / 100;
				});
			else if (["left", "right", "background"].includes(a))
				change((x) => {
					x.imagePos = a;
				});
		});
	}
	bar.dataset.key = key;
	const main = key === "image" && s.layout !== "image";
	const place = picPlacement(s);
	bar.innerHTML = empty
		? `<button type="button" data-pa="replace">Add picture</button><button type="button" data-pa="bot">Find with the Bot</button>`
		: `<button type="button" data-pa="replace" title="Replace">Replace</button>${key === "image" ? `<button type="button" data-pa="zout" title="Zoom out">−</button><button type="button" data-pa="zin" title="Zoom in">+</button>` : ""}${
				main
					? `<span class="sepv"></span>${["left", "right", "background"].map((p) => `<button type="button" data-pa="${p}" class="${place === p ? "on" : ""}">${{ left: "Left", right: "Right", background: "Behind" }[p]}</button>`).join("")}`
					: ""
			}<span class="sepv"></span><button type="button" data-pa="remove" class="danger" title="Remove">✕</button>`;
	const r = target.getBoundingClientRect();
	const top =
		key === "image" && place === "background"
			? $("#canvas").getBoundingClientRect().top + 8
			: r.top + 8;
	bar.style.left = `${Math.max(6, Math.min(r.right - bar.offsetWidth - 8, innerWidth - bar.offsetWidth - 6))}px`;
	bar.style.top = `${Math.max(6, top)}px`;
	clearTimeout(picTimer);
}
let picTimer = null;
function hidePicBar() {
	clearTimeout(picTimer);
	picTimer = setTimeout(() => $("#picbar")?.remove(), 400);
}

/* drag a picture to choose what stays in view */
let pan = null;
document.addEventListener("mousedown", (e) => {
	if (!ui.deck || e.button !== 0) return;
	// the picture last clicked: Delete removes it instead of the slide
	const hit = e.target.closest?.("#canvas [data-pic]");
	ui.selPic =
		hit && !hit.dataset.empty && !e.target.closest("[contenteditable]")
			? hit.dataset.pic
			: null;
	const pic = e.target.closest?.("#canvas [data-pic]");
	if (!pic || e.target.closest("[contenteditable]")) return;
	const img = pic.querySelector("img");
	if (!img) return;
	const key = pic.dataset.pic;
	const fkey = key.replace(/image$/, "imageFocus");
	const s = ui.deck.slides[ui.at];
	const [fx, fy] = String(getPath(s, fkey) || "50% 50%")
		.split(" ")
		.map((v) => Number.parseFloat(v));
	pan = {
		pic,
		img,
		fkey,
		x0: e.clientX,
		y0: e.clientY,
		fx: fx || 50,
		fy: fy || 50,
		moved: false,
	};
	e.preventDefault();
});
document.addEventListener("mousemove", (e) => {
	if (!pan) return;
	const dx = e.clientX - pan.x0;
	const dy = e.clientY - pan.y0;
	if (!pan.moved && Math.hypot(dx, dy) < 4) return;
	pan.moved = true;
	document.body.classList.add("panning");
	const r = pan.pic.getBoundingClientRect();
	const x = Math.max(0, Math.min(100, pan.fx - (dx / r.width) * 160));
	const y = Math.max(0, Math.min(100, pan.fy - (dy / r.height) * 160));
	pan.now = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
	pan.img.style.objectPosition = pan.now;
	pan.img.style.transformOrigin = pan.now;
});
document.addEventListener("mouseup", () => {
	if (!pan) return;
	const p = pan;
	pan = null;
	document.body.classList.remove("panning");
	if (p.moved && p.now)
		change((s) => setPath(s, p.fkey, p.now), { side: false });
});

/* drop a picture (a file, or one from the deck's pictures) onto the slide: left, behind or right */
let dropAt = null;
function dropTarget(e) {
	const c = $("#canvas").getBoundingClientRect();
	const s = ui.deck.slides[ui.at];
	// a person's photo slot under the pointer
	const under = document
		.elementFromPoint(e.clientX, e.clientY)
		?.closest?.("#canvas [data-pic]");
	if (under && under.dataset.pic !== "image")
		return { key: under.dataset.pic, rect: under.getBoundingClientRect() };
	if (s.layout === "image") return { key: "image", pos: null, rect: c };
	const fx = (e.clientX - c.left) / c.width;
	const pos = fx < 0.3 ? "left" : fx > 0.7 ? "right" : "background";
	return { key: "image", pos, rect: c };
}
function showDrop(t) {
	const box = $("#drop");
	const stage = $("#stage").getBoundingClientRect();
	const c = $("#canvas").getBoundingClientRect();
	box.hidden = false;
	box.style.left = `${c.left - stage.left + $("#stage").scrollLeft}px`;
	box.style.top = `${c.top - stage.top + $("#stage").scrollTop}px`;
	box.style.width = `${c.width}px`;
	box.style.height = `${c.height}px`;
	const s = ui.deck.slides[ui.at];
	if (t.key !== "image") {
		const r = t.rect;
		box.innerHTML = `<div class="dz on" style="position:absolute;left:${r.left - c.left}px;top:${r.top - c.top}px;width:${r.width}px;height:${r.height}px">Photo</div>`;
	} else if (s.layout === "image")
		box.innerHTML = `<div class="dz on" style="position:absolute;inset:0">Drop the picture</div>`;
	else
		box.innerHTML = `<div class="dzs"><div class="dz ${t.pos === "left" ? "on" : ""}">Left</div><div class="dz ${t.pos === "background" ? "on" : ""}">Behind the slide</div><div class="dz ${t.pos === "right" ? "on" : ""}">Right</div></div>`;
}
function hideDrop() {
	const box = $("#drop");
	if (box) box.hidden = true;
	dropAt = null;
}
const draggingPicture = (e) =>
	[...(e.dataTransfer?.types || [])].some(
		(t) => t === "Files" || t === "text/x-deck-image",
	);

document.addEventListener("dragover", (e) => {
	if (!ui.deck) return;
	const over = e.target.closest?.("#stage");
	if (over && draggingPicture(e)) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
		dropAt = dropTarget(e);
		showDrop(dropAt);
		return;
	}
	if (!over) hideDrop();
	const t = e.target.closest?.(".thumb");
	if (t && dragFrom !== null) {
		e.preventDefault();
		for (const x of $$(".thumb.drag-over")) x.classList.remove("drag-over");
		t.classList.add("drag-over");
	}
});
document.addEventListener("dragleave", (e) => {
	if (!e.relatedTarget || !e.relatedTarget.closest?.("#stage")) hideDrop();
});
document.addEventListener("drop", async (e) => {
	if (!ui.deck) return;
	if (e.target.closest?.("#stage") && draggingPicture(e)) {
		e.preventDefault();
		const t = dropAt || dropTarget(e);
		hideDrop();
		const lib = e.dataTransfer.getData("text/x-deck-image");
		const file = [...(e.dataTransfer.files || [])].find((f) =>
			f.type.startsWith("image/"),
		);
		const path = lib || (file ? await uploadPicture(file) : null);
		if (path) setPicture(path, t.key, t.key === "image" ? t.pos : null);
		return;
	}
	const t = e.target.closest?.(".thumb");
	if (!t || dragFrom === null) return;
	e.preventDefault();
	const from = dragFrom;
	dragFrom = null;
	moveSlide(from, Number(t.dataset.go));
});

async function deleteLibraryPicture(path) {
	const users = ui.deck.slides.filter((s) =>
		JSON.stringify(s).includes(`"${path}"`),
	).length;
	const m = popover(
		`<div class="confirm"><b>Delete this picture?</b><div class="muted small">${users ? `It is on ${users} slide${users > 1 ? "s" : ""}; it comes off ${users > 1 ? "them" : "it"}.` : "It is not on any slide."} The file is deleted.</div><div class="row"><button type="button" class="btn sm danger" data-yes>Delete</button><button type="button" class="btn ghost sm" data-no>Cancel</button></div></div>`,
		{ anchor: $(`[data-libimg="${CSS.escape(path)}"]`) },
	);
	m.addEventListener("click", async (e) => {
		if (e.target.closest("[data-no]")) return m.remove();
		if (!e.target.closest("[data-yes]")) return;
		m.remove();
		const strip = (o) => {
			if (!o || typeof o !== "object") return;
			for (const [k, v] of Object.entries(o)) {
				if (k === "image" && v === path) {
					delete o[k];
					if (o === ui.deck.slides.find((s) => s === o))
						for (const x of [
							"imagePos",
							"imageFocus",
							"imageZoom",
							"imageFit",
							"bgDim",
							"bgTint",
						])
							delete o[x];
				} else if (v && typeof v === "object") strip(v);
			}
		};
		remember();
		for (const s of ui.deck.slides) strip(s);
		await deepbot.files
			.delete(`${ROOT}/${ui.deck.slug}/${path}`)
			.catch(() => {});
		await loadImages();
		queueSave();
		drawRail();
		drawCanvas();
		drawSide();
	});
}

/* -------------------------------------------------------------------------- the right side */

let cat = [];
const familyOf = (id) => cat.find((f) => f.id === id)?.family || "Inter";

function seg(name, options, current, attrs = "") {
	return `<div class="seg" ${attrs}>${options.map(([v, label]) => `<button type="button" data-${name}="${esc(v)}" class="${String(current) === String(v) ? "on" : ""}">${label}</button>`).join("")}</div>`;
}

function drawSide() {
	const side = $("#side");
	if (!side) return;
	const keepScroll = side.scrollTop;
	side.innerHTML = `<div class="tabs">${seg(
		"tab",
		[
			["slide", "Slide"],
			["design", "Design"],
		],
		ui.tab,
	)}</div>${ui.tab === "design" ? designPanel() : slidePanel()}`;
	side.scrollTop = keepScroll;
}

function slidePanel() {
	const s = ui.deck.slides[ui.at];
	const list = LISTS[s.layout];
	const place = picPlacement(s);
	const count = list ? (getPath(s, list[0]) || []).length : 0;
	return `
    <h4>Layout</h4>
    <button type="button" class="laybtn" data-pick-layout><span>${esc(LAYOUTS[s.layout]?.name || s.layout)}</span><span class="muted small">Change ▾</span></button>
    ${
			list
				? `<div class="row" style="margin-top:8px"><span class="muted small" style="flex:1">${count} ${NOUN[s.layout] || "items"} · hover one on the slide to move or remove it</span><button type="button" class="btn ghost sm" data-item-add>+ Add</button></div>`
				: ""
		}
    ${s.layout === "table" ? tablePanel(s) : ""}
    ${s.layout === "chart" ? chartPanel(s) : ""}

    <h4>Picture</h4>
    ${
			s.image
				? `<div class="picnow"><img src="${esc(ui.ctx.resolve(s.image))}" alt=""><div class="picnow-a"><button type="button" class="btn ghost sm" data-pic-replace>Replace</button><button type="button" class="btn ghost sm" data-pic-remove>Remove</button></div></div>
      ${
				s.layout === "image"
					? ""
					: `<div class="lbl">Where</div>${seg(
							"pos",
							[
								["left", "Left"],
								["right", "Right"],
								["background", "Behind"],
							],
							place,
						)}`
			}
      <div class="lbl">Fit</div>${seg(
				"fit",
				[
					["cover", "Fill"],
					["contain", "Whole picture"],
				],
				s.imageFit === "contain" ? "contain" : "cover",
			)}
      <div class="lbl">Zoom <span class="muted small">· drag the picture on the slide to move it</span></div><input type="range" min="1" max="3" step="0.05" value="${Number(s.imageZoom) || 1}" id="zoom">
      ${
				place === "background"
					? `<div class="lbl">Shade</div>${seg(
							"tint",
							[
								["dark", "Dark"],
								["light", "Light"],
							],
							s.bgTint === "light" ? "light" : "dark",
						)}<input type="range" min="0" max="0.9" step="0.05" value="${s.bgDim ?? (s.bgTint === "light" ? 0.55 : 0.5)}" id="dim">`
					: ""
			}`
				: `<div class="muted small">Drop a picture onto the slide (left, right or behind it), paste one with ${MOD}+V, or:</div>`
		}
    <div class="row" style="margin-top:8px"><button type="button" class="btn ghost sm" data-pic-upload>Upload</button><button type="button" class="btn ghost sm" data-pic-bot>Find with the Bot</button></div>
    ${
			ui.images.length
				? `<div class="lbl">This deck's pictures <span class="muted small">· click or drag onto the slide</span></div><div class="imgs">${ui.images
						.map(
							(p) =>
								`<div class="libimg ${s.image === p ? "on" : ""}" data-libimg="${esc(p)}" draggable="true" title="${esc(p.split("/").pop())}"><img src="${esc(ui.ctx.resolve(p))}" alt="" draggable="false"><button type="button" class="x" data-libdel="${esc(p)}" title="Delete the picture" aria-label="Delete the picture">✕</button></div>`,
						)
						.join("")}</div>`
				: ""
		}

    <h4>Background</h4>
    ${seg(
			"accent",
			[
				["0", "Theme"],
				["1", "Colour"],
			],
			s.accent ? "1" : "0",
		)}

    <h4>Transition in</h4>
    <select class="in" id="slidetr"><option value="">Deck's (${esc(TRANSITIONS[transitionOf(ui.deck, {})].name)})</option>${Object.entries(
			TRANSITIONS,
		)
			.map(
				([k, v]) =>
					`<option value="${k}" ${s.transition === k ? "selected" : ""}>${v.name}</option>`,
			)
			.join("")}</select>

    <h4>Ask the Bot</h4>
    <div class="row"><input class="in" id="askslide" placeholder="Change this slide: shorter, a chart, other words…" style="flex:1"><button type="button" class="btn sm" data-ask-slide>Ask</button></div>

    <h4>This slide</h4>
    <div class="row"><button type="button" class="btn ghost sm" data-dup>Duplicate</button><button type="button" class="btn ghost sm" data-hide>${s.hidden ? "Show" : "Hide"}</button><button type="button" class="btn ghost sm danger-t" data-del>Delete</button><span class="muted small">Right-click a slide for more</span></div>`;
}

function tablePanel(s) {
	const cols = Math.max(
		(s.head || []).length,
		...(s.rows || []).map((r) => r.length),
		1,
	);
	return `<div class="row" style="margin-top:6px"><span class="muted small" style="flex:1">${cols} columns</span><button type="button" class="btn ghost sm" data-col="add">+ Column</button><button type="button" class="btn ghost sm" data-col="del" ${cols <= 1 ? "disabled" : ""}>− Column</button></div>
    <label class="row small" style="margin-top:6px"><input type="checkbox" id="tablehead" ${s.head?.length ? "checked" : ""}> Header row</label>`;
}

function chartPanel(s) {
	const c = s.chart || {};
	const labels = c.labels || [];
	const series = c.series || [];
	return `<h4>Chart</h4>
    <div class="row"><select class="in" id="ctype" style="flex:1">${["bar", "line", "area", "pie", "donut"].map((t) => `<option ${c.type === t ? "selected" : ""}>${t}</option>`).join("")}</select><input class="in" id="cunit" value="${esc(c.unit || "")}" placeholder="Unit (%, k, €)" style="width:110px"></div>
    <div class="row small" style="margin-top:6px"><label><input type="checkbox" id="cstacked" ${c.stacked ? "checked" : ""}> Stacked</label><label><input type="checkbox" id="choriz" ${c.horizontal ? "checked" : ""}> Horizontal</label></div>
    <div class="grid-ed"><table><thead><tr><th></th>${series.map((x, j) => `<th><input data-cs="${j}" value="${esc(x.name || "")}" placeholder="Series"><button type="button" data-csdel="${j}" title="Remove series">✕</button></th>`).join("")}</tr></thead><tbody>${labels
			.map(
				(l, i) =>
					`<tr><td><input data-cl="${i}" value="${esc(l)}"></td>${series.map((x, j) => `<td><input data-cv="${i}.${j}" value="${esc(x.values?.[i] ?? "")}" inputmode="decimal"></td>`).join("")}<td><button type="button" data-crdel="${i}" title="Remove row">✕</button></td></tr>`,
			)
			.join("")}</tbody></table></div>
    <div class="row"><button type="button" class="btn ghost sm" data-crow>+ Row</button><button type="button" class="btn ghost sm" data-cser>+ Series</button></div>`;
}

function designPanel() {
	const d = ui.deck;
	const brandNow = String(d.theme).startsWith("brand:")
		? String(d.theme).split(":")[1]
		: null;
	const tile = (id, t) =>
		`<button type="button" class="th-t ${d.theme === id || (brandNow && id === `brand:${brandNow}` && t.brand) ? "on" : ""}" data-theme="${esc(id)}"><div class="sw" style="background:${t.c.bg};color:${t.c.text}"><b style="font-family:'${esc(familyOf(t.fonts.head[0]))}';font-weight:${t.fonts.head[1]}">Aa</b><i><span style="background:${t.c.accent}"></span><span style="background:${t.c.accent2}"></span><span style="background:${t.c.accent3}"></span></i></div><div class="nm">${esc(t.name)}</div></button>`;
	return `
    <h4>Theme</h4><div class="themes">${THEMES.map((t) => tile(t.id, t)).join("")}</div>
    ${
			ui.brands.length
				? `<h4>Your brands</h4><div class="themes">${ui.brands.map((b) => tile(`brand:${b.slug}`, { ...brandTheme(b, { dark: false }), name: b.spec?.name || b.slug })).join("")}</div>
      ${
				brandNow
					? `<div class="lbl">${esc(ui.brands.find((b) => b.slug === brandNow)?.spec?.name || "Brand")}</div>${seg(
							"brandmode",
							[
								["light", "Light"],
								["dark", "Dark"],
							],
							String(d.theme).endsWith(":dark") ? "dark" : "light",
						)}`
					: ""
			}
      <div class="muted small" style="margin-top:6px">Brands come from the Logo designer.</div>`
				: ""
		}
    <h4>Transition</h4>
    <select class="in" id="decktr">${Object.entries(TRANSITIONS)
			.map(
				([k, v]) =>
					`<option value="${k}" ${transitionOf(d, {}) === k ? "selected" : ""}>${v.name}</option>`,
			)
			.join("")}</select>
    <div class="muted small">Between slides when presenting and in the web page. A slide can have its own (Slide tab).</div>
    <h4>Deck</h4>
    <div class="row"><span class="muted small" style="width:58px">Size</span>${seg(
			"size",
			[
				["16:9", "16:9"],
				["4:3", "4:3"],
			],
			d.size,
		)}</div>
    <div class="row" style="margin-top:6px"><span class="muted small" style="width:58px">Footer</span><input class="in" id="footer" value="${esc(d.footer || "")}" style="flex:1" placeholder="Company · Date"></div>
    <label class="row small" style="margin-top:6px"><input type="checkbox" id="nums" ${d.showNumbers ? "checked" : ""}> Slide numbers</label>
    <label class="row small"><input type="checkbox" id="logo" ${d.showLogo !== false ? "checked" : ""}> Logo on title and closing slides</label>`;
}

/* -------------------------------------------------------------------------- present */

function present(from = ui.at) {
	const slides = ui.deck.slides;
	const shown = slides
		.map((_, i) => i)
		.filter((i) => !slides[i].hidden || i === from);
	let pos = Math.max(0, shown.indexOf(from));
	let notes = false;
	let busy = false;
	const box = document.createElement("div");
	box.className = "present";
	box.tabIndex = 0;
	box.innerHTML = `<div class="pstage"></div><div class="pcount"></div><div class="pnotes" hidden></div>`;
	document.body.appendChild(box);
	const stage = $(".pstage", box);
	const make = () => {
		const [W, H] = ui.ctx.size;
		const k = Math.min(innerWidth / W, innerHeight / H);
		const el = document.createElement("div");
		el.className = "pslide";
		el.style.width = `${W * k}px`;
		el.style.height = `${H * k}px`;
		stage.appendChild(el);
		const i = shown[pos];
		mountSlide(el, slides[i], { ...ui.ctx, editable: false }, i, { scale: k });
		$(".pcount", box).textContent = `${pos + 1} / ${shown.length}`;
		const n = $(".pnotes", box);
		n.hidden = !(notes && slides[i].notes);
		n.textContent = slides[i].notes || "";
		return el;
	};
	let current = make();
	const step = (to) => {
		to = Math.max(0, Math.min(shown.length - 1, to));
		if (to === pos || busy) return;
		const dir = to > pos ? 1 : -1;
		const kind = transitionOf(ui.deck, slides[shown[dir > 0 ? to : pos]]);
		pos = to;
		const old = current;
		current = make();
		if (kind === "none") return old.remove();
		busy = true;
		play(kind, current, old, dir).then(() => {
			busy = false;
		});
	};
	const redraw = () => {
		stage.innerHTML = "";
		current = make();
	};
	const close = () => {
		removeEventListener("keydown", onKey, true);
		removeEventListener("resize", redraw);
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		box.remove();
		go(shown[pos]);
		drawRail();
	};
	const onKey = (e) => {
		if (["ArrowRight", "PageDown", " ", "Enter", "ArrowDown"].includes(e.key))
			step(pos + 1);
		else if (["ArrowLeft", "PageUp", "Backspace", "ArrowUp"].includes(e.key))
			step(pos - 1);
		else if (e.key === "Home") step(0);
		else if (e.key === "End") step(shown.length - 1);
		else if (e.key.toLowerCase() === "n") {
			notes = !notes;
			const n = $(".pnotes", box);
			n.hidden = !(notes && n.textContent);
		} else if (e.key === "Escape") return close();
		else return;
		e.preventDefault();
		e.stopPropagation();
	};
	box.addEventListener("click", (e) =>
		step(e.clientX < innerWidth / 3 ? pos - 1 : pos + 1),
	);
	document.addEventListener("fullscreenchange", function off() {
		if (!document.fullscreenElement && document.body.contains(box)) {
			document.removeEventListener("fullscreenchange", off);
			close();
		}
	});
	addEventListener("keydown", onKey, true);
	addEventListener("resize", redraw);
	box.requestFullscreen?.().catch(() => {});
	box.focus();
}

/* -------------------------------------------------------------------------- export */

function exportMenu(anchor) {
	const m = popover(
		`<button type="button" data-x="pdf">PDF</button><button type="button" data-x="pptx">PowerPoint (.pptx, editable)</button><button type="button" data-x="html">Web page (.html: presents, or scrolls as a site)</button><button type="button" data-x="site">A website, to publish from Site builder</button><div class="hint">Files are also saved to ${ROOT}/${esc(ui.deck.slug)}/. Hidden slides are left out.</div>`,
		{ anchor },
	);
	const r = anchor.getBoundingClientRect();
	m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
	m.addEventListener("click", async (e) => {
		const x = e.target.closest("[data-x]")?.dataset.x;
		if (!x) return;
		m.remove();
		await runExport(x);
	});
}

async function runExport(kind) {
	const d = ui.deck;
	const ctx = { ...ui.ctx, editable: false };
	const bar = document.createElement("div");
	bar.className = "progress";
	document.body.appendChild(bar);
	const prog = (i, n) => {
		bar.textContent = `${kind === "pptx" ? "PowerPoint" : kind.toUpperCase()}: slide ${i + 1} of ${n}…`;
	};
	let done = "";
	try {
		const name = slugify(d.title);
		if (kind === "pdf") {
			const blob = await toPdf(d, ctx, prog);
			await saveFile(`${name}.pdf`, blob);
			download(blob, `${name}.pdf`);
			done = `${name}.pdf is in your Downloads (and in ${ROOT}/${d.slug}).`;
		} else if (kind === "pptx") {
			const blob = await toPptx(d, ctx, prog);
			await saveFile(`${name}.pptx`, blob);
			download(blob, `${name}.pptx`);
			// PowerPoint uses the fonts installed on the computer: the theme's go next to the file
			const all = await fontCatalogue();
			const fams = [];
			for (const [id] of [ctx.theme.fonts.head, ctx.theme.fonts.body]) {
				const f = all.find((x) => x.id === id);
				if (!f || fams.includes(f.family)) continue;
				fams.push(f.family);
				for (const file of Object.values(f.files)) {
					const b = await (await fetch(`fonts/${file}`)).blob();
					await deepbot.files.write(
						`${ROOT}/${d.slug}/fonts/${file}`,
						await blobToBase64(b),
						{ encoding: "base64" },
					);
				}
			}
			toast(
				`${name}.pptx is in your Downloads. For the exact look, install ${fams.join(" and ")} (the fonts are in ${ROOT}/${d.slug}/fonts).`,
			);
			return;
		} else {
			bar.textContent = "Building the web page…";
			const html = await toHtml(d, ctx);
			if (kind === "html") {
				const blob = new Blob([html], { type: "text/html" });
				await saveFile(`${name}.html`, blob);
				download(blob, `${name}.html`);
				done = `${name}.html is in your Downloads. Open it to present, or add #scroll to read it as a page.`;
			} else {
				await toSite(d, html);
				done = `"${d.title}" is in Site builder now: open Apps, Site builder, to put it online.`;
			}
		}
		toast(done);
	} catch (error) {
		toast(`Not exported: ${error.message}`);
		console.error(error);
	} finally {
		bar.remove();
	}
}

async function saveFile(name, blob) {
	await deepbot.files.write(
		`${ROOT}/${ui.deck.slug}/${name}`,
		await blobToBase64(blob),
		{ encoding: "base64" },
	);
}

/* -------------------------------------------------------------------------- events */

/* A line to the Bot. What the app knows about the job goes as instructions the Bot reads and the
 * conversation does not show, where DeepBot keeps the conversation beside the page ("ask-beside");
 * an older DeepBot gets it in front of the words, as before. */
const ask = (text, context = "") =>
	(context && deepbot.features?.includes("ask-beside")
		? deepbot.ask(text, { instructions: [context] })
		: deepbot.ask(context ? `${context} ${text}` : text)
	).catch(() => {});
const where = () =>
	`[Deck studio · "${ui.deck.title}" (${ROOT}/${ui.deck.slug}/deck.json)]`;

document.addEventListener("click", async (e) => {
	if (e.target.closest("#toast [data-undo]")) {
		$("#toast")?.remove();
		return undo();
	}
	const t = e.target.closest(
		"button,[data-open],[data-go],[data-libimg],[data-pic][data-empty]",
	);
	if (!t) return;
	const d = t.dataset;
	const deck = ui.deck;
	if (d.deckmenu) {
		e.stopPropagation();
		return deckMenu(d.deckmenu, { anchor: t });
	}
	if (d.open) return openDeck(d.open);
	if (d.make !== undefined) {
		const v = $("#about").value.trim();
		if (!v) return $("#about").focus();
		return ask(v, "Make a presentation in Deck studio:");
	}
	if (d.blank !== undefined) {
		const slug = `deck-${Date.now().toString(36)}`;
		await saveDeck(
			normaliseDeck(
				{
					title: "Untitled deck",
					slides: [{ layout: "title", ...BLANK.title() }],
				},
				slug,
			),
		);
		return openDeck(slug);
	}
	if (d.home !== undefined) return library();
	if (!deck) return;
	if (d.undo !== undefined) return undo();
	if (d.redo !== undefined) return redo();
	if (d.go !== undefined) return go(Number(d.go));
	if (d.add !== undefined) return layoutPicker("new", { anchor: t }, ui.at + 1);
	if (d.pickLayout !== undefined)
		return layoutPicker("change", { anchor: t }, ui.at);
	if (d.pic !== undefined && d.empty) return choosePicture(d.pic);
	if (d.tab) {
		ui.tab = d.tab;
		return drawSide();
	}
	if (d.libdel) {
		e.stopPropagation();
		return deleteLibraryPicture(d.libdel);
	}
	if (d.libimg) return setPicture(d.libimg, "image");
	if (d.picUpload !== undefined || d.picReplace !== undefined)
		return choosePicture("image");
	if (d.picRemove !== undefined) return removePicture("image");
	if (d.picBot !== undefined) return askPicture();
	if (d.pos)
		return change((s) => {
			s.imagePos = d.pos;
		});
	if (d.fit)
		return change((s) => {
			if (d.fit === "contain") s.imageFit = "contain";
			else delete s.imageFit;
		});
	if (d.tint)
		return change((s) => {
			if (d.tint === "light") s.bgTint = "light";
			else delete s.bgTint;
			delete s.bgDim;
		});
	if (d.accent !== undefined && t.closest(".seg"))
		return change(
			(s) => {
				if (d.accent === "1") s.accent = true;
				else delete s.accent;
			},
			{ rail: true },
		);
	if (d.itemAdd !== undefined) {
		const s = deck.slides[ui.at];
		const [field, make] = LISTS[s.layout];
		return change((x) => {
			const list = getPath(x, field) || [];
			list.push(make(x));
			setPath(x, field, list);
		});
	}
	if (d.col) {
		return change((s) => {
			const cols = Math.max(
				(s.head || []).length,
				...(s.rows || []).map((r) => r.length),
				1,
			);
			if (d.col === "add") {
				if (s.head?.length) s.head.push("");
				for (const r of s.rows || []) r.push("");
			} else if (cols > 1) {
				if (s.head?.length) s.head.length = cols - 1;
				for (const r of s.rows || []) r.length = Math.min(r.length, cols - 1);
			}
		});
	}
	if (d.crow !== undefined || d.cser !== undefined || d.crdel || d.csdel) {
		return change((s) => {
			s.chart = s.chart || { type: "bar", labels: [], series: [] };
			const c = s.chart;
			c.labels = c.labels || [];
			c.series = c.series || [];
			if (d.crow !== undefined) {
				c.labels.push(`Item ${c.labels.length + 1}`);
				for (const x of c.series) {
					x.values = x.values || [];
					x.values.push(0);
				}
			} else if (d.cser !== undefined)
				c.series.push({
					name: `Series ${c.series.length + 1}`,
					values: c.labels.map(() => 0),
				});
			else if (d.crdel) {
				const i = Number(d.crdel);
				c.labels.splice(i, 1);
				for (const x of c.series) x.values?.splice(i, 1);
			} else if (d.csdel) c.series.splice(Number(d.csdel), 1);
		});
	}
	if (d.dup !== undefined) return duplicateSlide();
	if (d.hide !== undefined) return toggleHidden();
	if (d.del !== undefined) return deleteSlide();
	if (d.theme) {
		remember();
		deck.theme = d.theme;
		queueSave();
		return rebuild();
	}
	if (d.brandmode) {
		remember();
		const slug = String(deck.theme).split(":")[1];
		deck.theme = `brand:${slug}${d.brandmode === "dark" ? ":dark" : ""}`;
		queueSave();
		return rebuild();
	}
	if (d.size) {
		remember();
		deck.size = d.size;
		queueSave();
		return rebuild();
	}
	if (d.present !== undefined) return present();
	if (d.export !== undefined) return exportMenu(t);
	if (d.askDeck !== undefined) {
		const box = document.createElement("span");
		box.className = "row";
		box.innerHTML = `<input class="in" id="askdeck" placeholder="What should the Bot change in the deck?" style="width:340px"><button type="button" class="btn sm" data-ask-deck-send>Send</button>`;
		t.replaceWith(box);
		$("#askdeck").focus();
		return;
	}
	if (d.askDeckSend !== undefined) {
		const v = $("#askdeck").value.trim();
		if (!v) return $("#askdeck").focus();
		ask(v, where());
		$("#askdeck").value = "";
		return setStatus("Sent to the Bot");
	}
	if (d.askSlide !== undefined) {
		const v = $("#askslide").value.trim();
		if (!v) return $("#askslide").focus();
		ask(
			`Slide ${ui.at + 1}: ${v}`,
			`${where()} Slide ${ui.at + 1} is "${deck.slides[ui.at].title || deck.slides[ui.at].layout}".`,
		);
		$("#askslide").value = "";
		setStatus("Sent to the Bot");
	}
});

/** Content that means the same in another layout (points become cards, cards become points). */
function carry(s, to) {
	const pts = (s.bullets || s.items || s.cards || s.steps || []).map((b) =>
		typeof b === "string" ? { text: b } : b,
	);
	if (!pts.length) return {};
	const text = (p) => p.text || p.title || "";
	if (to === "bullets") return { bullets: pts.map(text) };
	if (to === "agenda") return { items: pts.map(text) };
	if (to === "cards")
		return {
			cards: pts.map((p) => ({
				icon: p.icon,
				title: p.title || text(p),
				text: p.title ? p.text : "",
			})),
		};
	if (to === "process" || to === "timeline")
		return {
			steps: pts.map((p) => ({
				title: p.title || text(p),
				text: p.title ? p.text : "",
				label: p.label,
				icon: p.icon,
			})),
		};
	return {};
}

document.addEventListener("input", (e) => {
	if (!ui.deck) return;
	const t = e.target;
	const s = ui.deck.slides[ui.at];
	if (t.id === "zoom") {
		const z = Number(t.value);
		if (!t.dataset.r) {
			remember();
			t.dataset.r = "1";
		}
		if (z <= 1.001) delete s.imageZoom;
		else s.imageZoom = z;
		queueSave(ui.at);
		drawCanvas();
	} else if (t.id === "dim") {
		if (!t.dataset.r) {
			remember();
			t.dataset.r = "1";
		}
		s.bgDim = Number(t.value);
		queueSave(ui.at);
		drawCanvas();
	} else if (
		t.dataset.cl !== undefined ||
		t.dataset.cv !== undefined ||
		t.dataset.cs !== undefined
	) {
		if (!t.dataset.r) {
			remember();
			t.dataset.r = "1";
		}
		const c = s.chart;
		if (t.dataset.cl !== undefined) c.labels[Number(t.dataset.cl)] = t.value;
		else if (t.dataset.cs !== undefined)
			c.series[Number(t.dataset.cs)].name = t.value;
		else {
			const [i, j] = t.dataset.cv.split(".").map(Number);
			const v = Number.parseFloat(String(t.value).replace(",", "."));
			c.series[j].values = c.series[j].values || [];
			c.series[j].values[i] = Number.isFinite(v) ? v : 0;
		}
		queueSave(ui.at);
		drawCanvas();
	}
});

document.addEventListener("change", async (e) => {
	if (!ui.deck) return;
	const t = e.target;
	const s = ui.deck.slides[ui.at];
	if (t.id === "dtitle") {
		remember();
		ui.deck.title = t.value.trim() || ui.deck.title;
		queueSave();
	} else if (t.id === "notes") {
		remember();
		s.notes = t.value;
		queueSave();
	} else if (t.id === "footer") {
		remember();
		ui.deck.footer = t.value;
		queueSave();
		await rebuild();
	} else if (t.id === "nums" || t.id === "logo") {
		remember();
		ui.deck[t.id === "nums" ? "showNumbers" : "showLogo"] = t.checked;
		queueSave();
		await rebuild();
	} else if (t.id === "decktr") {
		remember();
		ui.deck.transition = t.value;
		queueSave();
		drawSide();
	} else if (t.id === "slidetr")
		change((x) => {
			if (t.value) x.transition = t.value;
			else delete x.transition;
		});
	else if (
		t.id === "ctype" ||
		t.id === "cunit" ||
		t.id === "cstacked" ||
		t.id === "choriz"
	)
		change((x) => {
			x.chart = x.chart || {};
			const c = x.chart;
			if (t.id === "ctype") c.type = t.value;
			if (t.id === "cunit") c.unit = t.value;
			if (t.id === "cstacked") c.stacked = t.checked;
			if (t.id === "choriz") c.horizontal = t.checked;
		});
	else if (t.id === "tablehead")
		change((x) => {
			if (t.checked) {
				const cols = Math.max(...(x.rows || [[""]]).map((r) => r.length), 1);
				x.head = Array.from({ length: cols }, () => "");
			} else delete x.head;
		});
	else if (
		t.id === "zoom" ||
		t.id === "dim" ||
		t.dataset.cl !== undefined ||
		t.dataset.cv !== undefined ||
		t.dataset.cs !== undefined
	) {
		delete t.dataset.r;
		redrawThumb(ui.at);
	}
});

/* hover bars over items and pictures */
document.addEventListener("mouseover", (e) => {
	if (!ui.deck || pan) return;
	const inCanvas = e.target.closest?.("#canvas");
	const item = inCanvas && e.target.closest("[data-item]");
	if (item && item !== barItem) showItemBar(item);
	else if (!item && !e.target.closest?.("#itembar") && barItem) scheduleHide();
	const pic = inCanvas && e.target.closest("[data-pic]");
	if (pic && !e.target.closest("[contenteditable]") && !item) picBar(pic);
	else if (inCanvas && !pic) {
		// a picture behind the slide: show its bar while over the slide's empty parts
		const s = ui.deck.slides[ui.at];
		const bgp = $("#canvas .bgpic");
		if (bgp && !e.target.closest("[contenteditable],[data-item]") && s.image)
			picBar(bgp);
		else if (!e.target.closest?.("#picbar")) hidePicBar();
	} else if (!e.target.closest?.("#picbar")) hidePicBar();
});

/* icons on the slide: click to change */
document.addEventListener("click", (e) => {
	if (!ui.deck) return;
	const ic = e.target.closest?.("#canvas [data-icon]");
	if (!ic || e.target.closest("[contenteditable]")) return;
	iconPicker(ic.dataset.icon, ic);
});

/* a bar for bold, italic and highlight when text is selected on the slide */
document.addEventListener("selectionchange", () => {
	if (!ui.deck) return;
	const sel = getSelection();
	const ed = sel?.anchorNode?.parentElement?.closest?.(
		"#canvas [contenteditable]",
	);
	let bar = $("#textbar");
	if (!ed || sel.isCollapsed) {
		bar?.remove();
		return;
	}
	if (!bar) {
		bar = document.createElement("div");
		bar.id = "textbar";
		bar.className = "floatbar";
		bar.innerHTML = `<button type="button" data-fmt="bold" title="Bold (${MOD}+B)"><b>B</b></button><button type="button" data-fmt="italic" title="Italic (${MOD}+I)"><i>I</i></button><button type="button" data-fmt="hl" title="Highlight in the accent colour"><mark>A</mark></button><button type="button" data-fmt="clear" title="Plain text">T̸</button>`;
		document.body.appendChild(bar);
		bar.addEventListener("mousedown", (ev) => {
			ev.preventDefault();
			const f = ev.target.closest("[data-fmt]")?.dataset.fmt;
			if (!f) return;
			if (f === "bold" || f === "italic") document.execCommand(f);
			else if (f === "hl") {
				const text = getSelection().toString();
				document.execCommand(
					"insertHTML",
					false,
					`<mark class="hl">${esc(text)}</mark>`,
				);
			} else if (f === "clear") {
				const text = getSelection().toString();
				document.execCommand("insertText", false, text);
			}
		});
	}
	const r = sel.getRangeAt(0).getBoundingClientRect();
	bar.style.left = `${Math.max(6, r.left + r.width / 2 - bar.offsetWidth / 2)}px`;
	bar.style.top = `${Math.max(6, r.top - bar.offsetHeight - 8)}px`;
});

/* right-click: a slide in the rail or on the canvas */
document.addEventListener("contextmenu", (e) => {
	if (!ui.deck) {
		const dk = e.target.closest?.("[data-open]");
		if (dk) {
			e.preventDefault();
			deckMenu(dk.dataset.open, { x: e.clientX, y: e.clientY });
		}
		return;
	}
	const thumb = e.target.closest?.(".thumb");
	const onCanvas = e.target.closest?.("#canvas");
	if (
		onCanvas &&
		e.target.closest("[contenteditable]") &&
		!getSelection().isCollapsed
	)
		return; // the browser's (copy, spelling)
	if (thumb || onCanvas) {
		e.preventDefault();
		const i = thumb ? Number(thumb.dataset.go) : ui.at;
		if (thumb && i !== ui.at) go(i);
		slideMenu(i, { x: e.clientX, y: e.clientY });
	}
});

/* drag slides in the rail to reorder them; drag the deck's pictures onto the slide */
let dragFrom = null;
document.addEventListener("dragstart", (e) => {
	const lib = e.target.closest?.("[data-libimg]");
	if (lib) {
		e.dataTransfer.setData("text/x-deck-image", lib.dataset.libimg);
		e.dataTransfer.effectAllowed = "copy";
		return;
	}
	const t = e.target.closest?.(".thumb");
	if (t) dragFrom = Number(t.dataset.go);
});
document.addEventListener("dragend", () => {
	dragFrom = null;
	hideDrop();
	for (const x of $$(".thumb.drag-over")) x.classList.remove("drag-over");
});

/* paste a picture onto the slide */
document.addEventListener("paste", async (e) => {
	if (!ui.deck || document.querySelector(".present")) return;
	const file = [...(e.clipboardData?.items || [])]
		.find((i) => i.type.startsWith("image/"))
		?.getAsFile();
	if (file) {
		e.preventDefault();
		setPicture(await uploadPicture(file), "image");
		toast("Picture added: drag it to move, hover it for more");
		return;
	}
	if (!e.target.closest("[contenteditable],input,textarea") && ui.clip) {
		e.preventDefault();
		pasteSlide();
	}
});

document.addEventListener("keydown", (e) => {
	// Enter in a line to the Bot sends it, like its button
	if (
		e.key === "Enter" &&
		!e.shiftKey &&
		(e.target.id === "askslide" || e.target.id === "askdeck")
	) {
		e.preventDefault();
		return void $(
			e.target.id === "askslide" ? "[data-ask-slide]" : "[data-ask-deck-send]",
		)?.click();
	}
	if (!ui.deck || document.querySelector(".present")) return;
	const mod = e.ctrlKey || e.metaKey;
	const k = e.key.toLowerCase();
	const editing = e.target.closest?.("[contenteditable],input,textarea,select");
	if (mod && k === "z" && !editing) {
		e.preventDefault();
		return e.shiftKey ? redo() : undo();
	}
	if (mod && k === "y" && !editing) {
		e.preventDefault();
		return redo();
	}
	if (e.key === "F5" || (mod && e.key === "Enter")) {
		e.preventDefault();
		return present(e.shiftKey ? 0 : ui.at);
	}
	if (editing) return;
	if (mod && k === "d") {
		e.preventDefault();
		return duplicateSlide();
	}
	if (mod && k === "m") {
		e.preventDefault();
		return layoutPicker("new", { anchor: $("[data-add]") }, ui.at + 1);
	}
	if (mod && k === "c" && getSelection().isCollapsed) return copySlide();
	if (mod && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
		e.preventDefault();
		return moveSlide(ui.at, ui.at + (e.key === "ArrowUp" ? -1 : 1));
	}
	if (e.key === "Delete" || e.key === "Backspace") {
		e.preventDefault();
		if (ui.selPic) {
			const k = ui.selPic;
			ui.selPic = null;
			removePicture(k);
			return toast("Picture removed", { undo: true });
		}
		return deleteSlide();
	}
	if (e.key === "Escape") return closePopovers();
	if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown")
		go(ui.at + 1);
	else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp")
		go(ui.at - 1);
	else if (e.key === "Home") go(0);
	else if (e.key === "End") go(ui.deck.slides.length - 1);
	else return;
	e.preventDefault();
});

// a picture in the side panel or the library that is not there any more: a frame that says so
document.addEventListener(
	"error",
	(e) => {
		const box =
			e.target?.tagName === "IMG" && e.target.closest(".picnow, .libimg");
		if (box) box.classList.add("missing");
	},
	true,
);

let railWidth = 0;
/*
 * THE BOT CHANGES THE DECK WHILE IT IS OPEN ("Ask the Bot" keeps the conversation beside the page):
 * the editor follows. Not while the person is typing into a slide or a save is on its way, and the
 * change can be undone like any other.
 */
async function watchDeck() {
	if (!ui.deck || document.hidden || saveTimer || $(".present")) return;
	const slug = ui.deck.slug;
	const next = await changedOnDisk(slug);
	if (!next || ui.deck?.slug !== slug) return;
	const typing = editingDeck();
	if (typing) {
		pendingDisk = next;
		return;
	}
	applyDisk(next);
}
let pendingDisk = null;
/** The person is typing into the deck itself (a slide, the notes, the title, a field on the side). */
function editingDeck() {
	const a = document.activeElement;
	if (!a || a === document.body || a.id === "askslide" || a.id === "askdeck")
		return false;
	return Boolean(a.closest?.("[contenteditable], textarea, input, select"));
}
const libSig = (decks) =>
	decks
		.map(
			(d) => `${d.slug}:${d.modified}:${d.slides.length}:${d.title}:${d.theme}`,
		)
		.join("|");
/** On the list of decks: one the Bot is making appears (and grows) by itself. */
async function watchLibrary() {
	if (ui.deck || document.hidden || !$(".lib") || $(".pop, .menu")) return;
	const decks = await listDecks().catch(() => null);
	if (!decks || ui.deck || libSig(decks) === ui.libSig) return;
	await library();
}
setInterval(watchLibrary, 4000);
async function applyDisk(next) {
	pendingDisk = null;
	remember();
	ui.deck = next;
	ui.at = Math.min(ui.at, ui.deck.slides.length - 1);
	await loadImages();
	await rebuild();
	toast("The Bot changed the deck.", { undo: true });
}
document.addEventListener("focusout", () => {
	setTimeout(() => {
		if (pendingDisk && !editingDeck()) applyDisk(pendingDisk);
	}, 0);
});
setInterval(watchDeck, 3000);

addEventListener("resize", () => {
	if (!ui.deck || document.querySelector(".present")) return;
	drawCanvas();
	// the rail changes width at the breakpoints: its thumbnails are drawn again to fit
	const w = $("#rail .thumb")?.clientWidth || 0;
	if (w && w !== railWidth) {
		railWidth = w;
		drawRail();
	}
});

if (window.deepbot) {
	deepbot.ready.then(async (init) => {
		cat = await fontCatalogue();
		await ensureFonts(THEMES);
		const a = init.args || {};
		try {
			if (a.deck) await openDeck(String(a.deck), Number(a.slide) || 0);
			else await library();
			if (a.present && ui.deck) present(Number(a.slide) || 0);
		} catch (err) {
			root().innerHTML = `<div class="wrap"><b>Could not open that deck.</b><div class="muted">${esc(err.message)}</div><button type="button" class="btn" style="margin-top:10px" data-home>All decks</button></div>`;
		}
	});
}
