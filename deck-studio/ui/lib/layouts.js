/*
 * SLIDES: every layout a deck can use, drawn as HTML on a fixed 1920 x 1080 (or 1440 x 1080) canvas in
 * the deck's theme. One function per layout, all built from the same few pieces, so a theme or an
 * edit changes every slide the same way. Text a person can edit carries data-k (its path in the
 * slide); what PowerPoint export needs to rebuild carries data-pp.
 */
import { artSvg, backgroundCss } from "./art.js";
import { chartSvg } from "./charts.js";
import { icon } from "./icons.js";
import { luminance } from "./themes.js";

export const SIZES = { "16:9": [1920, 1080], "4:3": [1440, 1080] };

export const LAYOUTS = {
	title: { name: "Title", loud: true },
	section: { name: "Section", loud: true },
	agenda: { name: "Agenda" },
	bullets: { name: "Points" },
	split: { name: "Text and picture" },
	cards: { name: "Cards" },
	stats: { name: "Big numbers" },
	chart: { name: "Chart" },
	quote: { name: "Quote" },
	timeline: { name: "Timeline" },
	process: { name: "Steps" },
	compare: { name: "Compare" },
	table: { name: "Table" },
	team: { name: "People" },
	image: { name: "Full picture", loud: true },
	statement: { name: "Statement", loud: true },
	closing: { name: "Closing", loud: true },
};

export function esc(s) {
	return String(s ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);
}

/** **bold**, *italic*, ==highlight== (in the accent colour), line breaks. */
export function md(text) {
	return esc(text)
		.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
		.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<i>$2</i>")
		.replace(/==(.+?)==/g, '<mark class="hl">$1</mark>')
		.replace(/\n/g, "<br>");
}

/** Back from edited HTML to the same markup. */
export function htmlToMd(html) {
	return String(html || "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(div|p)>\s*<(div|p)[^>]*>/gi, "\n")
		.replace(/<(b|strong)>(.*?)<\/\1>/gi, "**$2**")
		.replace(/<(i|em)>(.*?)<\/\1>/gi, "*$2*")
		.replace(/<mark[^>]*>(.*?)<\/mark>/gi, "==$1==")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/* -------------------------------------------------------------------------- pieces */

function T(tag, k, value, cls = "", ed = false) {
	if (value === undefined || value === null || value === "") return "";
	return `<${tag} class="${cls}" data-k="${k}" data-pp="text"${ed ? ' contenteditable="true" spellcheck="false"' : ""}>${md(value)}</${tag}>`;
}

function kicker(s, ctx) {
	return T("div", "kicker", s.kicker, "kicker", ctx.editable);
}

function heading(s, ctx, cls = "h2") {
	return `${kicker(s, ctx)}${T("h2", "title", s.title, cls, ctx.editable)}`;
}

/*
 * PICTURES. A slide has one main picture (`image`) and says where it goes (`imagePos`): "right" or
 * "left" (Title, Text and picture and Quote frame it beside the text; every other layout gets it as a
 * full-height panel on that side), or "background" (behind everything, under a shade of `bgDim`,
 * dark or light by `bgTint`). Full picture always fills the slide. `imageFocus` ("x% y%") is the
 * point that stays in view, `imageZoom` (1-3) how far in, `imageFit` "contain" shows all of it.
 */
const FRAMED = { title: true, split: true, quote: true };
const BG_FIRST = { section: true, statement: true, closing: true };

export function picPlacement(s) {
	if (!s?.image) return null;
	if (s.layout === "image") return "full";
	const p = s.imagePos || (s.side === "left" ? "left" : null);
	if (p === "background" || p === "left" || p === "right") return p;
	return BG_FIRST[s.layout] ? "background" : "right";
}

function picStyle(s) {
	if (!s) return "";
	const focus = /^\d+(\.\d+)?% \d+(\.\d+)?%$/.test(String(s.imageFocus || ""))
		? s.imageFocus
		: "50% 50%";
	const zoom = Math.min(3, Math.max(1, Number(s.imageZoom) || 1));
	const fit = s.imageFit === "contain" ? "contain" : "cover";
	return `object-fit:${fit};object-position:${focus};${zoom !== 1 ? `transform:scale(${zoom});transform-origin:${focus};` : ""}`;
}

function img(src, ctx, cls = "pic", k = "image", s = null) {
	if (!src) return "";
	const url = ctx.resolve ? ctx.resolve(src) : src;
	return `<div class="${cls}" data-pp="img" data-k="${k}" data-pic="${k}"><img src="${esc(url)}" alt="" crossorigin="anonymous" draggable="false" style="${picStyle(s)}"></div>`;
}

/** A tinted panel with a large icon, for a split slide without a picture. */
function placeholderArt(s, ctx) {
	const name = s.icon || "sparkles";
	return `<div class="pic pic-art" data-pp="box" data-pic="image" data-empty="1"><div class="pic-art-in" data-icon="icon">${icon(name, { size: 220, stroke: 1.2, colour: ctx.theme.c.accent })}</div></div>`;
}

function iconBadge(name, ctx, size = 44, path = "") {
	if (!name) return "";
	return `<span class="ic" data-pp="icon"${path ? ` data-icon="${path}"` : ""}>${icon(name, { size, stroke: 2, colour: ctx.theme.c.accent })}</span>`;
}

function items(list) {
	return (Array.isArray(list) ? list : []).map((b) =>
		typeof b === "string" ? { text: b } : b || {},
	);
}

/* -------------------------------------------------------------------------- layouts */

const L = {
	title(s, ctx) {
		const hasPic = !!s.image;
		return `<div class="content title-c ${hasPic ? "with-pic" : ""} ${hasPic && s.imagePos === "left" ? "pic-left" : ""}"><div class="title-text">
      ${ctx.logo ? `<div class="logo" data-pp="img"><img src="${esc(ctx.logo)}" alt=""></div>` : ""}
      ${kicker(s, ctx)}${T("h1", "title", s.title, "h1", ctx.editable)}${T("p", "subtitle", s.subtitle, "lead", ctx.editable)}
      ${T("div", "byline", s.byline, "byline", ctx.editable)}</div>
      ${hasPic ? img(s.image, ctx, "pic title-pic", "image", s) : ""}</div>`;
	},
	section(s, ctx) {
		return `<div class="content section-c">${s.number !== undefined ? `<div class="sec-num" data-pp="text" data-k="number">${esc(String(s.number).padStart(2, "0"))}</div>` : ""}
      ${T("h1", "title", s.title, "h1", ctx.editable)}${T("p", "subtitle", s.subtitle, "lead", ctx.editable)}</div>`;
	},
	agenda(s, ctx) {
		const list = items(s.items);
		return `<div class="content">${heading(s, ctx)}<ol class="agenda ${list.length > 5 ? "two" : ""}">${list
			.map(
				(it, i) =>
					`<li data-item="items.${i}"><span class="an" data-pp="text">${String(i + 1).padStart(2, "0")}</span>${T("span", `items.${i}${typeof s.items[i] === "string" ? "" : ".text"}`, it.text || it.title, "at", ctx.editable)}</li>`,
			)
			.join("")}</ol></div>`;
	},
	bullets(s, ctx) {
		const list = items(s.bullets);
		const rich = list.some((b) => b.title);
		return `<div class="content">${heading(s, ctx)}${T("p", "intro", s.intro, "lead small", ctx.editable)}
      <ul class="bul ${rich ? "rich" : ""} ${list.length > 5 && !rich ? "two" : ""}">${list
				.map((b, i) => {
					const base =
						typeof s.bullets[i] === "string"
							? `bullets.${i}`
							: `bullets.${i}.text`;
					return `<li data-item="bullets.${i}">${b.icon ? iconBadge(b.icon, ctx, 40, `bullets.${i}.icon`) : '<span class="dot" data-pp="box"></span>'}<div>${b.title ? T("b", `bullets.${i}.title`, b.title, "bt", ctx.editable) : ""}${T("span", base, b.text, "bx", ctx.editable)}</div></li>`;
				})
				.join("")}</ul></div>`;
	},
	split(s, ctx) {
		const list = items(s.bullets);
		const left = s.imagePos ? s.imagePos === "left" : s.side === "left";
		if (s._bgpic)
			return `<div class="content split-c solo"><div class="split-text">${heading(s, ctx)}${T("p", "text", s.text, "body", ctx.editable)}
      ${list.length ? `<ul class="bul">${list.map((b, i) => `<li><span class="dot" data-pp="box"></span><div>${T("span", typeof s.bullets[i] === "string" ? `bullets.${i}` : `bullets.${i}.text`, b.text, "bx", ctx.editable)}</div></li>`).join("")}</ul>` : ""}</div></div>`;
		return `<div class="content split-c ${left ? "pic-left" : ""}"><div class="split-text">${heading(s, ctx)}${T("p", "text", s.text, "body", ctx.editable)}
      ${list.length ? `<ul class="bul">${list.map((b, i) => `<li data-item="bullets.${i}"><span class="dot" data-pp="box"></span><div>${T("span", typeof s.bullets[i] === "string" ? `bullets.${i}` : `bullets.${i}.text`, b.text, "bx", ctx.editable)}</div></li>`).join("")}</ul>` : ""}</div>
      ${s.image ? img(s.image, ctx, "pic split-pic", "image", s) : placeholderArt(s, ctx)}</div>`;
	},
	cards(s, ctx) {
		const list = items(s.cards);
		const cols = list.length <= 3 ? list.length : list.length === 4 ? 2 : 3;
		return `<div class="content">${heading(s, ctx)}${T("p", "intro", s.intro, "lead small", ctx.editable)}
      <div class="cards" style="grid-template-columns:repeat(${Math.max(1, cols)},1fr)">${list
				.map(
					(c, i) =>
						`<div class="card" data-pp="box" data-item="cards.${i}">${c.icon ? iconBadge(c.icon, ctx, 52, `cards.${i}.icon`) : `<span class="cnum" data-pp="text" data-icon="cards.${i}.icon">${String(i + 1).padStart(2, "0")}</span>`}${T("h3", `cards.${i}.title`, c.title, "h3", ctx.editable)}${T("p", `cards.${i}.text`, c.text, "ct", ctx.editable)}</div>`,
				)
				.join("")}</div></div>`;
	},
	stats(s, ctx) {
		const list = items(s.stats);
		return `<div class="content">${heading(s, ctx)}<div class="stats" style="grid-template-columns:repeat(${Math.min(4, Math.max(1, list.length))},1fr)">${list
			.map(
				(st, i) =>
					`<div class="stat" data-item="stats.${i}">${T("div", `stats.${i}.value`, st.value, "sv", ctx.editable)}${T("div", `stats.${i}.label`, st.label, "sl", ctx.editable)}${T("div", `stats.${i}.detail`, st.detail, "sd", ctx.editable)}</div>`,
			)
			.join(
				"",
			)}</div>${T("p", "note", s.note, "foot-note", ctx.editable)}</div>`;
	},
	chart(s, ctx) {
		const side = s.text || s.points?.length;
		const [W, H] = ctx.size;
		const cw = side ? W * 0.56 : W - 280;
		const ch = H - 420;
		const t = ctx.theme;
		const svg = chartSvg(
			{ ...(s.chart || {}), bg: t.c.bg },
			Math.round(cw),
			Math.round(ch),
			{
				colours: [t.c.accent, t.c.accent2, t.c.accent3, t.c.muted, t.c.text],
				text: t.c.text,
				muted: t.c.muted,
				line: t.c.line,
				font: `${getFamily(t, "body")}, sans-serif`,
			},
		);
		return `<div class="content">${heading(s, ctx)}<div class="chart-row ${side ? "with-side" : ""}"><div class="chart" data-pp="chart">${svg}</div>
      ${
				side
					? `<div class="chart-side">${T("p", "text", s.text, "body", ctx.editable)}${items(
							s.points,
						)
							.map(
								(p, i) =>
									`<div class="cp" data-item="points.${i}"><span class="dot" data-pp="box"></span>${T("span", `points.${i}`, p.text, "bx", ctx.editable)}</div>`,
							)
							.join("")}</div>`
					: ""
			}</div>
      ${T("p", "source", s.source, "foot-note", ctx.editable)}</div>`;
	},
	quote(s, ctx) {
		return `<div class="content quote-c ${s.image ? "with-pic" : ""} ${s.image && s.imagePos === "left" ? "pic-left" : ""}"><div class="q-text"><div class="qmark" data-pp="text">“</div>${T("blockquote", "quote", s.quote, "qq", ctx.editable)}
      <div class="qby">${T("b", "author", s.author, "qa", ctx.editable)}${T("span", "role", s.role, "qr", ctx.editable)}</div></div>${s.image ? img(s.image, ctx, "pic q-pic", "image", s) : ""}</div>`;
	},
	timeline(s, ctx) {
		const list = items(s.steps);
		return `<div class="content">${heading(s, ctx)}<div class="tl" style="grid-template-columns:repeat(${Math.max(1, list.length)},1fr)"><div class="tl-line" data-pp="box"></div>${list
			.map(
				(st, i) =>
					`<div class="tl-i" data-item="steps.${i}"><div class="tl-dot" data-pp="box"></div>${T("div", `steps.${i}.label`, st.label || st.date, "tl-d", ctx.editable)}${T("h3", `steps.${i}.title`, st.title, "h3", ctx.editable)}${T("p", `steps.${i}.text`, st.text, "ct", ctx.editable)}</div>`,
			)
			.join("")}</div></div>`;
	},
	process(s, ctx) {
		const list = items(s.steps);
		return `<div class="content">${heading(s, ctx)}<div class="proc" style="grid-template-columns:repeat(${Math.max(1, list.length)},1fr)">${list
			.map(
				(st, i) =>
					`<div class="pr-i" data-pp="box" data-item="steps.${i}"><div class="pr-n" data-pp="text" data-icon="steps.${i}.icon">${st.icon ? icon(st.icon, { size: 40, stroke: 2, colour: "currentColor" }) : i + 1}</div>${T("h3", `steps.${i}.title`, st.title, "h3", ctx.editable)}${T("p", `steps.${i}.text`, st.text, "ct", ctx.editable)}${i < list.length - 1 ? `<div class="pr-arrow" data-pp="icon">${icon("arrow-right", { size: 36, stroke: 2.4, colour: ctx.theme.c.accent })}</div>` : ""}</div>`,
			)
			.join("")}</div></div>`;
	},
	compare(s, ctx) {
		const cols = items(s.columns);
		return `<div class="content">${heading(s, ctx)}<div class="cmp" style="grid-template-columns:repeat(${Math.max(1, cols.length)},1fr)">${cols
			.map(
				(
					c,
					i,
				) => `<div class="cmp-c ${c.highlight ? "hi" : ""}" data-pp="box" data-item="columns.${i}">${T("h3", `columns.${i}.title`, c.title, "h3", ctx.editable)}${T("div", `columns.${i}.price`, c.price, "price", ctx.editable)}${T("p", `columns.${i}.text`, c.text, "ct", ctx.editable)}
        <ul>${(c.points || []).map((p, j) => `<li><span class="ck" data-pp="icon">${icon(c.cons ? "x" : "check", { size: 30, stroke: 2.6, colour: c.highlight ? "var(--on-accent)" : c.cons ? ctx.theme.c.muted : ctx.theme.c.accent })}</span>${T("span", `columns.${i}.points.${j}`, p, "bx", ctx.editable)}</li>`).join("")}</ul></div>`,
			)
			.join("")}</div></div>`;
	},
	table(s, ctx) {
		const head = s.head || [];
		const rows = s.rows || [];
		return `<div class="content">${heading(s, ctx)}<div class="tbl" data-pp="table"><table>${head.length ? `<thead><tr>${head.map((h, i) => `<th>${T("span", `head.${i}`, h, "", ctx.editable)}</th>`).join("")}</tr></thead>` : ""}<tbody>${rows
			.map(
				(r, i) =>
					`<tr data-item="rows.${i}">${r.map((cell, j) => `<td>${T("span", `rows.${i}.${j}`, cell, "", ctx.editable)}</td>`).join("")}</tr>`,
			)
			.join(
				"",
			)}</tbody></table></div>${T("p", "note", s.note, "foot-note", ctx.editable)}</div>`;
	},
	team(s, ctx) {
		const people = items(s.people);
		return `<div class="content">${heading(s, ctx)}<div class="team" style="grid-template-columns:repeat(${Math.min(5, Math.max(1, people.length))},1fr)">${people
			.map((p, i) => {
				const initials = String(p.name || "?")
					.split(/\s+/)
					.map((w) => w[0])
					.slice(0, 2)
					.join("")
					.toUpperCase();
				return `<div class="person" data-item="people.${i}">${p.image ? img(p.image, ctx, "pic avatar", `people.${i}.image`, { imageFocus: p.imageFocus }) : `<div class="avatar ini" data-pp="box" data-pic="people.${i}.image" data-empty="1"><span data-pp="text">${esc(initials)}</span></div>`}${T("h3", `people.${i}.name`, p.name, "h3", ctx.editable)}${T("p", `people.${i}.role`, p.role, "ct", ctx.editable)}</div>`;
			})
			.join("")}</div></div>`;
	},
	image(s, ctx) {
		return `${s.image ? img(s.image, ctx, "pic full-pic", "image", s) : `<div class="pic full-pic empty-pic" data-pic="image"></div>`}<div class="full-shade"></div><div class="content image-c">${kicker(s, ctx)}${T("h1", "title", s.title, "h1", ctx.editable)}${T("p", "caption", s.caption, "lead", ctx.editable)}</div>`;
	},
	statement(s, ctx) {
		return `<div class="content statement-c">${kicker(s, ctx)}${T("h1", "text", s.text || s.title, "statement", ctx.editable)}${T("p", "subtitle", s.subtitle, "lead", ctx.editable)}</div>`;
	},
	closing(s, ctx) {
		return `<div class="content closing-c">${ctx.logo ? `<div class="logo" data-pp="img"><img src="${esc(ctx.logo)}" alt=""></div>` : ""}${T("h1", "title", s.title, "h1", ctx.editable)}${T("p", "subtitle", s.subtitle, "lead", ctx.editable)}
      ${s.cta ? `<div class="cta" data-pp="box">${T("span", "cta", s.cta, "", ctx.editable)}</div>` : ""}${T("div", "contact", s.contact, "byline", ctx.editable)}</div>`;
	},
};

function getFamily(t, which) {
	return `'${t.families?.[which] || "Inter"}'`;
}

/**
 * One slide as HTML. ctx: { theme, size: [W, H], index, total, editable, resolve(path) -> url,
 * logo (url), footer, vars (theme CSS variables) }
 */
export function slideHtml(slide, ctx) {
	const layout = LAYOUTS[slide.layout] ? slide.layout : "bullets";
	const loud = !!LAYOUTS[layout].loud || slide.accent === true;
	const t = ctx.theme;
	const [W, H] = ctx.size;
	const vars = Object.entries(ctx.vars || {})
		.map(([k, v]) => `${k}:${v}`)
		.join(";");
	const place = picPlacement({ ...slide, layout });
	const bgPic = place === "background";
	const sidePic = (place === "left" || place === "right") && !FRAMED[layout];
	// what the layout itself draws: no picture when it goes behind or beside it
	const own = bgPic
		? { ...slide, image: undefined, _bgpic: true }
		: sidePic
			? { ...slide, image: undefined }
			: slide;
	// a loud slide on a coloured band (Corporate) turns its text light
	const inverse =
		!bgPic &&
		((t.bg === "band" && loud && layout !== "image") || slide.accent === true);
	const bg =
		slide.accent === true && !bgPic
			? `linear-gradient(135deg, ${t.c.accent}, ${t.c.accent2})`
			: backgroundCss(t, loud);
	const invVars = inverse
		? `;--text:${luminance(t.c.accent) > 0.5 ? "#111" : "#fff"};--muted:${luminance(t.c.accent) > 0.5 ? "rgba(0,0,0,.65)" : "rgba(255,255,255,.78)"};--accent:${luminance(t.c.accent) > 0.5 ? "#111" : "#fff"}`
		: "";
	// a picture behind the slide: a shade over it, and text, cards and lines that read on it
	const light = slide.bgTint === "light";
	const dim = Math.min(
		0.9,
		Math.max(0, Number(slide.bgDim ?? (light ? 0.55 : 0.5)) || 0),
	);
	const onPic = light ? "#111111" : "#FFFFFF";
	const picAccent = light
		? t.c.accent
		: [t.c.accent, t.c.accent2, t.c.accent3].find((c) => luminance(c) > 0.32) ||
			"#FFFFFF";
	const bgVars = bgPic
		? light
			? `;--text:#111;--muted:rgba(0,0,0,.68);--surface:rgba(255,255,255,.62);--line:rgba(0,0,0,.18);--bg2:rgba(255,255,255,.4)`
			: `;--text:#fff;--muted:rgba(255,255,255,.82);--surface:rgba(0,0,0,.34);--line:rgba(255,255,255,.3);--bg2:rgba(255,255,255,.1);--accent:${picAccent};--on-accent:${luminance(picAccent) > 0.4 ? "#111111" : "#FFFFFF"}`
		: "";
	const ctx2 = {
		...ctx,
		theme: inverse
			? {
					...t,
					c: {
						...t.c,
						accent: luminance(t.c.accent) > 0.5 ? "#111111" : "#FFFFFF",
					},
				}
			: bgPic
				? { ...t, c: { ...t.c, accent: picAccent, text: onPic } }
				: t,
	};
	const footer =
		!loud && (ctx.footer || ctx.showNumbers)
			? `<div class="foot">${ctx.footer ? `<span data-pp="text">${esc(ctx.footer)}</span>` : "<span></span>"}${ctx.showNumbers ? `<span data-pp="text">${ctx.index + 1}</span>` : ""}</div>`
			: "";
	const under = bgPic
		? `<div class="bgpic" data-pic="image"><img src="${esc(ctx.resolve ? ctx.resolve(slide.image) : slide.image)}" alt="" crossorigin="anonymous" draggable="false" style="${picStyle(slide)}"></div><div class="bgshade" style="background:${light ? `rgba(255,255,255,${dim})` : `linear-gradient(180deg, rgba(0,0,0,${dim * 0.75}), rgba(0,0,0,${dim}))`}"></div>`
		: layout === "image"
			? ""
			: artSvg(t, W, H, { index: ctx.index || 0, loud });
	const side = sidePic
		? `<div class="sidepic" data-pp="img" data-k="image" data-pic="image"><img src="${esc(ctx.resolve ? ctx.resolve(slide.image) : slide.image)}" alt="" crossorigin="anonymous" draggable="false" style="${picStyle(slide)}"></div>`
		: "";
	const cls = [
		"slide",
		`L-${layout}`,
		t.dark || (bgPic && !light) ? "dark" : "light",
		`card-${t.card}`,
		inverse ? "inverse" : "",
		bgPic ? `on-pic ${light ? "on-light" : "on-dark"}` : "",
		sidePic ? `side-pic side-${place}` : "",
	]
		.filter(Boolean)
		.join(" ");
	return `<div class="${cls}" data-layout="${layout}" style="width:${W}px;height:${H}px;${vars}${invVars}${bgVars};background:${bg}">
    ${under}${side}${L[layout](own, ctx2)}${footer}</div>`;
}

/** Shrink a slide's text until it fits (each layout sets its sizes in em of --fs). */
export function fitSlide(el) {
	const content = el.querySelector(".content");
	if (!content) return 1;
	let fs = 1;
	el.style.setProperty("--fs", "1");
	for (
		let i = 0;
		i < 12 && content.scrollHeight > content.clientHeight + 2;
		i++
	) {
		fs -= 0.05;
		el.style.setProperty("--fs", fs.toFixed(2));
	}
	return fs;
}

/** Read an edited field back into the slide object (k: "cards.1.title"). */
export function setPath(obj, k, value) {
	const parts = k.split(".");
	let o = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const p = parts[i];
		const nextIsIndex = /^\d+$/.test(parts[i + 1]);
		if (o[p] === undefined || o[p] === null || typeof o[p] !== "object")
			o[p] = nextIsIndex ? [] : {};
		o = o[p];
	}
	o[parts.at(-1)] = value;
	return obj;
}
