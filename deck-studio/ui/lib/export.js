/*
 * GETTING A DECK OUT: a PDF (every slide as a sharp picture, the way it looks here), a PowerPoint file
 * that stays editable (text boxes where the text is, native charts and tables, pictures and the
 * background as images), and a single HTML file that presents itself or scrolls as a one-page site
 * (fonts and pictures inside it), which Site builder can publish. Everything runs in the page.
 */

import { chartData } from "./charts.js";
import { fontCatalogue, slugify, workspacePath } from "./deck.js";
import { blobToBase64, pdf } from "./files.js";
import { fitSlide, slideHtml } from "./layouts.js";
import { PLAY_SOURCE, transitionOf } from "./transitions.js";

const H2I = () => window.htmlToImage;

const MIME = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	svg: "image/svg+xml",
};
const mimeOf = (path) =>
	MIME[String(path).split(".").pop().toLowerCase()] ||
	"application/octet-stream";

/*
 * A page in a locked frame cannot let html-to-image read its stylesheets or fetch pictures across
 * origins, so both are handed over ready: the theme's fonts as one @font-face block of data URLs, and
 * every picture of the deck read through DeepBot and put inline.
 */
let fontCss = "";
async function prepare(deck, ctx) {
	const cat = await fontCatalogue();
	fontCss = "";
	for (const [id] of [ctx.theme.fonts.head, ctx.theme.fonts.body]) {
		const f = cat.find((x) => x.id === id);
		if (!f) continue;
		for (const [w, file] of Object.entries(f.files))
			fontCss += `@font-face{font-family:'${f.family}';font-weight:${w};src:url(${await dataUrl(`fonts/${file}`)})}`;
	}
	const paths = new Set();
	// every picture a slide names, wherever it sits (the slide, a person, a card)
	const collect = (o) => {
		if (!o || typeof o !== "object") return;
		for (const [k, v] of Object.entries(o)) {
			if (k === "image" && typeof v === "string" && v) paths.add(v);
			else if (v && typeof v === "object") collect(v);
		}
	};
	for (const s of deck.slides) collect(s);
	if (ctx.logoPath) paths.add(ctx.logoPath);
	const cache = new Map();
	for (const src of paths) {
		const full = workspacePath(deck, src);
		try {
			if (full)
				cache.set(
					src,
					`data:${mimeOf(full)};base64,${await deepbot.files.read(full, "base64")}`,
				);
			else if (/^https?:/.test(src)) cache.set(src, await dataUrl(src));
		} catch {
			// a missing picture stays a gap: an empty image, not a link that breaks outside DeepBot
			cache.set(src, BLANK);
		}
	}
	return {
		...ctx,
		resolve: (src) => cache.get(src) || ctx.resolve(src),
		logo: ctx.logoPath ? cache.get(ctx.logoPath) || ctx.logo : ctx.logo,
	};
}

const BLANK =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const snapOpts = (o) => ({
	...o,
	fontEmbedCSS: fontCss || " ",
	cacheBust: false,
});
const png = (node, o = {}) => H2I().toPng(node, snapOpts(o));
const jpeg = (node, o = {}) => H2I().toJpeg(node, snapOpts(o));

/** Render every slide at full size, off screen; calls fn(el, slide, i) for each, then cleans up. */
export async function eachSlide(deck0, ctx0, fn, onProgress = () => {}) {
	// hidden slides stay in the deck but not in what leaves it
	const deck = { ...deck0, slides: deck0.slides.filter((s) => !s.hidden) };
	const ctx = await prepare(deck, ctx0);
	const [W, H] = ctx.size;
	const stage = document.createElement("div");
	stage.style.cssText = `position:fixed;left:-${W + 200}px;top:0;width:${W}px;height:${H}px;overflow:hidden;pointer-events:none`;
	document.body.appendChild(stage);
	try {
		for (let i = 0; i < deck.slides.length; i++) {
			onProgress(i, deck.slides.length);
			stage.innerHTML = slideHtml(deck.slides[i], {
				...ctx,
				editable: false,
				index: i,
			});
			const el = stage.firstElementChild;
			await Promise.all(
				[...el.querySelectorAll("img")].map((img) =>
					img.complete
						? null
						: new Promise((r) => {
								img.onload = r;
								img.onerror = r;
							}),
				),
			);
			// a picture that did not load would fail the whole export: it leaves a gap instead
			for (const img of el.querySelectorAll("img"))
				if (!img.naturalWidth || img.getAttribute("src") === BLANK)
					img.remove();
			fitSlide(el);
			await fn(el, deck.slides[i], i);
		}
	} finally {
		stage.remove();
	}
}

const imgOpts = (W, H) => ({
	width: W,
	height: H,
	pixelRatio: 1,
	cacheBust: false,
	skipAutoScale: true,
});

/* -------------------------------------------------------------------------- PDF */

export async function toPdf(deck, ctx, onProgress) {
	const [W, H] = ctx.size;
	const pages = [];
	await eachSlide(
		deck,
		ctx,
		async (el) => {
			const url = await jpeg(el, {
				...imgOpts(W, H),
				quality: 0.93,
				pixelRatio: 1.25,
			});
			const blob = await (await fetch(url)).blob();
			pages.push({
				jpeg: blob,
				width: Math.round(W * 1.25),
				height: Math.round(H * 1.25),
				dpi: 144 * 1.25,
			});
		},
		onProgress,
	);
	return pdf(pages);
}

/** One slide as a PNG data URL (thumbnails, the card, a share picture). */
export async function slidePng(deck, ctx, index, pixelRatio = 0.5) {
	const [W, H] = ctx.size;
	let out = "";
	await eachSlide(
		{ ...deck, slides: [deck.slides[index]] },
		{ ...ctx },
		async (el) => {
			out = await png(el, { ...imgOpts(W, H), pixelRatio });
		},
	);
	return out;
}

/* -------------------------------------------------------------------------- PowerPoint */

const px2in = (px) => px / 144; // 1920 px = 13.333 in on a 16:9 slide, 1440 px = 10 in on 4:3
const hex = (css) => {
	const m = /rgba?\(([^)]+)\)/.exec(css || "");
	if (!m) return css?.startsWith("#") ? css.slice(1, 7).toUpperCase() : null;
	const [r, g, b, a = 1] = m[1].split(",").map((v) => Number.parseFloat(v));
	if (a < 0.05) return null;
	return [r, g, b]
		.map((v) => Math.round(v).toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase();
};
const firstFamily = (ff) =>
	String(ff || "Arial")
		.split(",")[0]
		.replace(/["']/g, "")
		.trim();

function rectIn(el, base) {
	const r = el.getBoundingClientRect();
	return {
		x: px2in(r.left - base.left),
		y: px2in(r.top - base.top),
		w: px2in(r.width),
		h: px2in(r.height),
	};
}

/** Text runs of an element: bold, italic and highlighted pieces keep their look. */
function runsOf(el, upper) {
	const runs = [];
	const walk = (node, style) => {
		if (node.nodeType === 3) {
			let text = node.textContent.replace(/\s+/g, " ");
			if (!text) return;
			if (upper) text = text.toUpperCase();
			runs.push({ text, options: { ...style } });
			return;
		}
		if (node.nodeType !== 1) return;
		if (node.tagName === "BR") {
			runs.push({ text: "", options: { ...style, breakLine: true } });
			return;
		}
		if (node.tagName === "svg") return;
		const cs = getComputedStyle(node);
		const next = { ...style };
		if (Number.parseInt(cs.fontWeight, 10) >= 600) next.bold = true;
		if (cs.fontStyle === "italic") next.italic = true;
		const c = hex(cs.color);
		if (c) next.color = c;
		for (const child of node.childNodes) walk(child, next);
	};
	walk(el, {});
	// trim the ends
	if (runs.length) {
		runs[0].text = runs[0].text.replace(/^\s+/, "");
		runs.at(-1).text = runs.at(-1).text.replace(/\s+$/, "");
	}
	return runs.filter((r) => r.text || r.options.breakLine);
}

export async function toPptx(deck, ctx, onProgress) {
	const Pptx = window.PptxGenJS;
	const pres = new Pptx();
	const [W, H] = ctx.size;
	if (deck.size === "4:3") {
		pres.defineLayout({ name: "D43", width: 10, height: 7.5 });
		pres.layout = "D43";
	} else pres.layout = "LAYOUT_WIDE";
	pres.title = deck.title;
	const t = ctx.theme;
	const palette = [
		t.c.accent,
		t.c.accent2,
		t.c.accent3,
		t.c.muted,
		t.c.text,
	].map((c) => c.replace("#", "").toUpperCase());

	await eachSlide(
		deck,
		ctx,
		async (el, slide) => {
			const base = el.getBoundingClientRect();
			const s = pres.addSlide();
			if (slide.notes) s.addNotes(String(slide.notes));
			// background + decoration as one picture, without the content
			const hide = el.querySelectorAll(".content, .foot, .sidepic");
			for (const h of hide) h.style.visibility = "hidden";
			// a JPEG: the background is never see-through, and a deck of PNGs was 8 MB for 15 slides
			const bg = await jpeg(el, {
				...imgOpts(W, H),
				pixelRatio: 1,
				quality: 0.86,
			});
			for (const h of hide) h.style.visibility = "";
			s.background = { data: bg };

			for (const node of el.querySelectorAll("[data-pp]")) {
				const kind = node.dataset.pp;
				if (node.closest(".foot") && kind !== "text") continue;
				// what a native chart or table already carries is not drawn again on top of it
				const owner = node.parentElement?.closest(
					'[data-pp="table"],[data-pp="chart"]',
				);
				if (owner) continue;
				const r = rectIn(node, base);
				if (r.w <= 0.01 || r.h <= 0.01) continue;
				const cs = getComputedStyle(node);
				if (kind === "chart") {
					const d = chartData(slide.chart || {});
					const type =
						{
							bar: pres.ChartType.bar,
							line: pres.ChartType.line,
							area: pres.ChartType.area,
							pie: pres.ChartType.pie,
							donut: pres.ChartType.doughnut,
						}[d.type] || pres.ChartType.bar;
					s.addChart(
						type,
						d.series.map((x) => ({
							name: x.name,
							labels: d.labels,
							values: x.values,
						})),
						{
							...r,
							chartColors:
								d.series.length > 1 || d.type === "pie" || d.type === "donut"
									? palette
									: [palette[0]],
							barDir: d.horizontal ? "bar" : "col",
							barGrouping: d.stacked ? "stacked" : "clustered",
							showValue: d.type !== "line" && d.type !== "area",
							showLegend:
								d.series.length > 1 || d.type === "pie" || d.type === "donut",
							legendPos: d.type === "pie" || d.type === "donut" ? "r" : "t",
							showPercent: d.type === "pie" || d.type === "donut",
							catAxisLabelColor: t.c.muted.replace("#", ""),
							valAxisLabelColor: t.c.muted.replace("#", ""),
							dataLabelColor: t.c.text.replace("#", ""),
							legendColor: t.c.text.replace("#", ""),
							catAxisLabelFontFace: t.families?.body,
							valAxisLabelFontFace: t.families?.body,
							valGridLine: { color: t.c.line.replace("#", ""), size: 0.75 },
						},
					);
					continue;
				}
				if (kind === "table") {
					const head = slide.head || [];
					const rows = [
						...(head.length ? [head] : []),
						...(slide.rows || []),
					].map((row, i) =>
						row.map((cell) => ({
							text: String(cell ?? "").replace(/\*\*|==/g, ""),
							options:
								i === 0 && head.length
									? {
											bold: true,
											color:
												hex(
													getComputedStyle(node.querySelector("th") || node)
														.color,
												) || "FFFFFF",
											fill: { color: t.c.accent.replace("#", "") },
										}
									: {},
						})),
					);
					s.addTable(rows, {
						...r,
						fontFace: t.families?.body,
						fontSize: 14,
						color: t.c.text.replace("#", ""),
						border: {
							type: "solid",
							pt: 0.75,
							color: t.c.line.replace("#", ""),
						},
					});
					continue;
				}
				if (
					kind === "img" ||
					kind === "icon" ||
					(kind === "box" && /gradient/.test(cs.backgroundImage))
				) {
					// drawn on its own: an absolutely placed panel (a picture beside the slide) is put
					// where the snapshot can see it
					const url = await png(node, {
						pixelRatio: kind === "icon" ? 2 : 1.5,
						cacheBust: false,
						width: node.offsetWidth,
						height: node.offsetHeight,
						style: {
							position: "relative",
							left: "0",
							top: "0",
							right: "auto",
							bottom: "auto",
							margin: "0",
						},
					});
					s.addImage({ data: url, ...r });
					continue;
				}
				if (kind === "box") {
					const fill = hex(cs.backgroundColor);
					const line =
						Number.parseFloat(cs.borderTopWidth) > 0
							? hex(cs.borderTopColor)
							: null;
					if (!fill && !line) continue;
					const radius = Number.parseFloat(cs.borderTopLeftRadius) || 0;
					s.addShape(
						radius > 0 ? pres.ShapeType.roundRect : pres.ShapeType.rect,
						{
							...r,
							fill: fill ? { color: fill } : { type: "none" },
							line: line
								? {
										color: line,
										width: Number.parseFloat(cs.borderTopWidth) * 0.5,
									}
								: { type: "none" },
							...(radius > 0
								? {
										rectRadius: Math.min(
											0.5,
											radius / Math.min(node.offsetWidth, node.offsetHeight),
										),
									}
								: {}),
						},
					);
					continue;
				}
				if (kind === "text") {
					if (!node.innerText.trim()) {
						if (node.querySelector("svg")) {
							const url = await png(node, {
								pixelRatio: 2,
								cacheBust: false,
							});
							s.addImage({ data: url, ...r });
						}
						continue;
					}
					const size = Number.parseFloat(cs.fontSize) * 0.5;
					const lh = Number.parseFloat(cs.lineHeight);
					const upper = cs.textTransform === "uppercase";
					s.addText(runsOf(node, upper), {
						// a little room: PowerPoint's line breaking is not the browser's, and a missing font is wider
						x: r.x - 0.04,
						y: r.y - 0.02,
						w: r.w * 1.06 + 0.12,
						h: r.h + 0.06,
						margin: 0,
						fontFace: firstFamily(cs.fontFamily),
						fontSize: Math.max(6, Math.round(size * 10) / 10),
						color: hex(cs.color) || "000000",
						bold: Number.parseInt(cs.fontWeight, 10) >= 600,
						italic: cs.fontStyle === "italic",
						align:
							cs.textAlign === "center"
								? "center"
								: cs.textAlign === "right" || cs.textAlign === "end"
									? "right"
									: "left",
						valign: "top",
						charSpacing: Number.parseFloat(cs.letterSpacing)
							? Number.parseFloat(cs.letterSpacing) * 0.5
							: undefined,
						lineSpacingMultiple: Number.isFinite(lh)
							? Math.max(0.8, lh / Number.parseFloat(cs.fontSize))
							: undefined,
						fit: "shrink",
						wrap: true,
					});
				}
			}
		},
		onProgress,
	);
	const blob = await pres.write({ outputType: "blob" });
	return withTransitions(blob, deck);
}

/*
 * PowerPoint's own transitions for each slide (PptxGenJS has none): written into the slides' XML.
 * The nearest PowerPoint has to each of ours.
 */
const PPT_TRANSITION = {
	fade: "<p:fade/>",
	slide: '<p:cover dir="l"/>',
	push: '<p:push dir="l"/>',
	zoom: "<p:zoom/>",
	rise: '<p:cover dir="u"/>',
	flip: '<p:split orient="vert" dir="out"/>',
};
async function withTransitions(blob, deck) {
	const Zip = window.JSZip;
	if (!Zip) return blob;
	try {
		const zip = await Zip.loadAsync(blob);
		const shown = deck.slides.filter((s) => !s.hidden);
		for (let i = 0; i < shown.length; i++) {
			const xml = PPT_TRANSITION[transitionOf(deck, shown[i])];
			const path = `ppt/slides/slide${i + 1}.xml`;
			const file = zip.file(path);
			if (!xml || !file) continue;
			const text = await file.async("string");
			if (text.includes("<p:transition")) continue;
			zip.file(
				path,
				text.replace(
					"</p:clrMapOvr>",
					`</p:clrMapOvr><p:transition spd="med">${xml}</p:transition>`,
				),
			);
		}
		return await zip.generateAsync({
			type: "blob",
			mimeType:
				"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			compression: "DEFLATE",
		});
	} catch {
		return blob;
	}
}

/* -------------------------------------------------------------------------- HTML */

async function dataUrl(url) {
	try {
		const blob = await (await fetch(url)).blob();
		return `data:${blob.type || "application/octet-stream"};base64,${await blobToBase64(blob)}`;
	} catch {
		return url;
	}
}

/**
 * One self-contained HTML file: it presents (arrows, click, F for full screen) and, with #scroll in
 * the address or on a narrow screen, reads as a one-page site of stacked slides.
 */
export async function toHtml(deck, ctx) {
	const [W, H] = ctx.size;
	const css = await (await fetch("lib/deck.css")).text();
	const pc = await prepare(deck, ctx);
	const fonts = fontCss; // the theme's fonts, inlined by prepare
	let slides = "";
	const shown = deck.slides.filter((s) => !s.hidden);
	for (let i = 0; i < shown.length; i++) {
		const html = slideHtml(shown[i], {
			...pc,
			editable: false,
			index: i,
		});
		slides += `<section class="frame" data-notes="${String(shown[i].notes || "").replace(/"/g, "&quot;")}" data-tr="${transitionOf(deck, shown[i])}">${html}</section>`;
	}
	const title = String(deck.title).replace(/</g, "&lt;");
	return `<!doctype html><html lang="${deck.lang || "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<meta property="og:title" content="${title.replace(/"/g, "&quot;")}"><meta name="generator" content="DeepBot Deck studio">
<style>${fonts}${css}
html,body{margin:0;background:#111;height:100%}
body.present{overflow:hidden}
.frame{display:none;position:fixed;inset:0;align-items:center;justify-content:center}
.frame.on,.frame.leaving{display:flex}
.frame.on{z-index:2}.frame.leaving{z-index:1}
.frame>.slide{transform-origin:center center;flex:none;box-shadow:0 30px 80px rgba(0,0,0,.4)}
body.scroll{background:#e9e9e9;overflow:auto}
body.scroll .frame{display:block;position:relative;margin:0 auto 24px;overflow:hidden}
body.scroll .frame>.slide{transform-origin:0 0;box-shadow:none}
.hud{position:fixed;bottom:14px;right:16px;color:#bbb;font:13px system-ui;z-index:9;opacity:.7}
body.scroll .hud{display:none}
</style></head><body class="present">${slides}<div class="hud"></div>
<script>
const W=${W},H=${H};const frames=[...document.querySelectorAll(".frame")];let i=0;
const scroll=location.hash==="#scroll"||innerWidth<700;addEventListener("hashchange",()=>location.reload());
function fit(){frames.forEach(f=>{const s=f.firstElementChild;if(document.body.classList.contains("scroll")){const k=Math.min(1,(innerWidth-0)/W);s.style.transform="scale("+k+")";f.style.width=W*k+"px";f.style.height=H*k+"px";}else{const k=Math.min(innerWidth/W,innerHeight/H);s.style.transform="scale("+k+")";f.style.width="";f.style.height="";}})}
${PLAY_SOURCE}
function show(n,anim){const was=i;i=Math.max(0,Math.min(frames.length-1,n));const prev=frames[was];frames.forEach((f,j)=>f.classList.toggle("on",j===i));document.querySelector(".hud").textContent=(i+1)+" / "+frames.length;if(anim&&was!==i&&!document.body.classList.contains("scroll")){prev.classList.add("leaving");const dir=i>was?1:-1;play(frames[dir>0?i:was].dataset.tr||"fade",frames[i],prev,dir).then(()=>prev.classList.remove("leaving"));}}
if(scroll){document.body.classList.replace("present","scroll");}
addEventListener("resize",fit);
addEventListener("keydown",e=>{if(document.body.classList.contains("scroll"))return;if(["ArrowRight","PageDown"," ","Enter"].includes(e.key))show(i+1,1);if(["ArrowLeft","PageUp","Backspace"].includes(e.key))show(i-1,1);if(e.key==="Home")show(0);if(e.key==="End")show(frames.length-1);if(e.key==="f")document.documentElement.requestFullscreen?.();});
addEventListener("click",e=>{if(document.body.classList.contains("scroll"))return;show(e.clientX<innerWidth/3?i-1:i+1,1)});
fit();show(0);
</script></body></html>`;
}

/** Put the HTML into Site builder's folder, so it can be published from Sites. */
export async function toSite(deck, html) {
	const slug = `${slugify(deck.slug)}-deck`;
	await deepbot.files.write(`sites/${slug}/public/index.html`, html);
	// exported again: keep what Sites knows (where it is published, the domain), or the next
	// publish would make a second site on the host instead of updating the first
	const before = await deepbot.files
		.read(`sites/${slug}/site.json`, "json")
		.catch(() => null);
	await deepbot.files.write(
		`sites/${slug}/site.json`,
		JSON.stringify(
			{ ...(before || {}), name: deck.title, slug, from: `decks/${deck.slug}` },
			null,
			2,
		),
	);
	return slug;
}
