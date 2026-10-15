/*
 * DECKS ON DISK: decks/<slug>/deck.json (title, theme, size, slides) and decks/<slug>/images/ for the
 * pictures in it. The Bot writes them; Deck studio reads, edits and saves them. Everything that
 * turns a deck into slides (its theme, fonts, logo) is put together here once.
 */
import { fitSlide, LAYOUTS, SIZES, slideHtml } from "./layouts.js";
import {
	brandTheme,
	fontFaces,
	THEMES,
	themeById,
	themeVars,
} from "./themes.js";

export const ROOT = "decks";

export function slugify(text) {
	return (
		String(text || "")
			.toLowerCase()
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/đ/g, "dj")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 60) || "deck"
	);
}

let idSeq = 0;
export const newId = () =>
	`s${Date.now().toString(36)}${(idSeq++).toString(36)}`;

export function normaliseDeck(raw, slug = "") {
	const d = raw && typeof raw === "object" ? structuredClone(raw) : {};
	d.format = "deepbot.deck/v1";
	// the folder is the deck: a slug written inside deck.json that disagrees with it would save elsewhere
	d.slug = slug || d.slug || slugify(d.title);
	d.title = d.title || "Untitled deck";
	d.theme = d.theme || "paper";
	d.size = SIZES[d.size] ? d.size : "16:9";
	d.showNumbers = d.showNumbers !== false;
	d.slides = (Array.isArray(d.slides) ? d.slides : [])
		.filter((s) => s && typeof s === "object")
		.map((s) => ({
			...s,
			id: s.id || newId(),
			layout: LAYOUTS[s.layout] ? s.layout : "bullets",
		}));
	if (!d.slides.length)
		d.slides.push({ id: newId(), layout: "title", title: d.title });
	return d;
}

export async function listDecks() {
	const top = await deepbot.files.list(ROOT).catch(() => ({ items: [] }));
	const out = [];
	for (const dir of (top.items || []).filter((i) => i.dir)) {
		try {
			const raw = await deepbot.files.read(`${dir.path}/deck.json`, "json");
			out.push({
				...normaliseDeck(raw, dir.name),
				modified: dir.modified || 0,
			});
		} catch {
			/* a folder without a deck */
		}
	}
	return out.sort((a, b) => (b.modified || 0) - (a.modified || 0));
}

export async function readDeck(slug) {
	return normaliseDeck(
		await deepbot.files.read(`${ROOT}/${slug}/deck.json`, "json"),
		slug,
	);
}

/** What this page last wrote to each deck.json, so a change by someone else (the Bot) is told apart. */
const written = new Map();

export async function saveDeck(deck) {
	const { modified: _m, ...rest } = deck;
	const text = JSON.stringify(rest, null, 2);
	written.set(deck.slug, text);
	await deepbot.files.write(`${ROOT}/${deck.slug}/deck.json`, text);
}

/**
 * The deck as it is on disk now, when it is not what this page wrote or last read: the Bot changed
 * it. Null when nothing changed (or the file cannot be read right now).
 */
export async function changedOnDisk(slug) {
	const text = await deepbot.files
		.read(`${ROOT}/${slug}/deck.json`, "text")
		.catch(() => null);
	if (text === null || text === written.get(slug)) return null;
	const first = !written.has(slug);
	written.set(slug, text);
	if (first) return null;
	try {
		return normaliseDeck(JSON.parse(text), slug);
	} catch {
		return null; // half written: the next look gets the whole file
	}
}

/* -------------------------------------------------------------------------- look */

let catalogue = null;
export async function fontCatalogue() {
	if (catalogue) return catalogue;
	try {
		catalogue = await (await fetch("fonts/fonts.json")).json();
	} catch {
		catalogue = [];
	}
	return catalogue;
}

const brandCache = new Map();
export async function readBrand(slug) {
	if (!brandCache.has(slug))
		brandCache.set(
			slug,
			deepbot.files
				.read(`brands/${slug}/brand.json`, "json")
				.then((b) => ({ ...b, slug }))
				.catch(() => null),
		);
	return brandCache.get(slug);
}

export async function listBrands() {
	const top = await deepbot.files.list("brands").catch(() => ({ items: [] }));
	const out = [];
	for (const d of (top.items || []).filter((i) => i.dir)) {
		const b = await readBrand(d.name);
		if (b) out.push(b);
	}
	return out;
}

/** The theme object for a deck: a built-in one, or "brand:<slug>" / "brand:<slug>:dark". */
export async function resolveTheme(id) {
	const cat = await fontCatalogue();
	let t;
	if (String(id).startsWith("brand:")) {
		const [, slug, dark] = String(id).split(":");
		const brand = await readBrand(slug);
		t = brand ? brandTheme(brand, { dark: dark === "dark" }) : THEMES[0];
	} else t = themeById(id);
	const fam = (fid) => cat.find((f) => f.id === fid)?.family || "Inter";
	return {
		...t,
		families: { head: fam(t.fonts.head[0]), body: fam(t.fonts.body[0]) },
	};
}

/** @font-face for every theme (and brand fonts), put into the page once per set. */
const injected = new Set();
export async function ensureFonts(themes) {
	const cat = await fontCatalogue();
	const css = fontFaces(themes, cat, new URL("fonts/", location.href).href);
	if (injected.has(css)) return;
	injected.add(css);
	const style = document.createElement("style");
	style.textContent = css;
	document.head.appendChild(style);
	// wait for the faces used, so measuring (fit) and export see the real glyphs
	const fams = new Set(
		themes
			.flatMap((t) => [t.fonts.head, t.fonts.body])
			.map(
				([id, w]) =>
					`${w} 40px "${cat.find((f) => f.id === id)?.family || "Inter"}"`,
			),
	);
	await Promise.all(
		[...fams].map((f) => document.fonts.load(f).catch(() => null)),
	);
}

/** A workspace path or a URL, as something an <img> can show. */
/** The workspace path of a picture named in a deck (relative to the deck's folder), or null for a URL. */
export function workspacePath(deck, src) {
	if (!src || /^(https?:|data:|blob:)/.test(src)) return null;
	return src.startsWith(`${ROOT}/`) || src.startsWith("brands/")
		? src
		: `${ROOT}/${deck.slug}/${src.replace(/^\.?\//, "")}`;
}

export function resolver(deck) {
	return (src) => {
		if (!src) return "";
		if (/^(https?:|data:|blob:)/.test(src)) return src;
		const path =
			src.startsWith(`${ROOT}/`) || src.startsWith("brands/")
				? src
				: `${ROOT}/${deck.slug}/${src.replace(/^\.?\//, "")}`;
		return deepbot.files.url(path);
	};
}

/** Everything slideHtml needs, for one deck. */
export async function deckContext(deck, { editable = false } = {}) {
	const theme = await resolveTheme(deck.theme);
	await ensureFonts([theme]);
	const resolve = resolver(deck);
	let logoPath = deck.logo || "";
	if (!logoPath && theme.brand && deck.showLogo !== false)
		logoPath = `brands/${theme.brand}/logo.svg`;
	const logo = logoPath ? resolve(logoPath) : "";
	return {
		theme,
		size: SIZES[deck.size],
		vars: themeVars(theme, await fontCatalogue()),
		resolve,
		logo: deck.showLogo === false ? "" : logo,
		logoPath: deck.showLogo === false ? "" : logoPath,
		footer: deck.footer || "",
		showNumbers: deck.showNumbers,
		total: deck.slides.length,
		editable,
	};
}

/** Render one slide into a host element (scaled to the host's width) and fit its text. */
export function mountSlide(host, slide, ctx, index, { scale = null } = {}) {
	const [W, H] = ctx.size;
	host.innerHTML = slideHtml(slide, { ...ctx, index });
	const el = host.firstElementChild;
	const k = scale ?? (host.clientWidth || W) / W;
	el.style.transform = `scale(${k})`;
	el.style.transformOrigin = "0 0";
	host.style.height = `${H * k}px`;
	host.style.position = "relative";
	host.style.overflow = "hidden";
	// images change the layout when they arrive: fit again then
	fitSlide(el);
	for (const img of el.querySelectorAll("img")) {
		// a picture the deck names but the folder does not have: a quiet frame that says so, not a broken image
		const missing = () =>
			(img.closest(".pic, .sidepic, .bgpic, .logo") || img).classList.add(
				"missing",
			);
		if (img.complete && img.naturalWidth === 0 && img.getAttribute("src"))
			missing();
		else if (!img.complete) {
			img.addEventListener("load", () => fitSlide(el), { once: true });
			img.addEventListener("error", missing, { once: true });
		}
	}
	return el;
}

export { THEMES };
