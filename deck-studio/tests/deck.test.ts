import { describe, expect, test } from "bun:test";
import sample from "./sample-deck.json";

const L = await import("../ui/lib/layouts.js");
const C = await import("../ui/lib/charts.js");
const T = await import("../ui/lib/themes.js");
const D = await import("../ui/lib/deck.js");
const A = await import("../ui/lib/art.js");
const Tr = await import("../ui/lib/transitions.js");

const theme = { ...T.THEMES[0], families: { head: "Fraunces", body: "Inter" } };
const ctx = (extra = {}) => ({
	theme,
	size: [1920, 1080],
	vars: T.themeVars(theme, []),
	index: 0,
	...extra,
});

describe("text", () => {
	test("markup to HTML and back", () => {
		const md = "Coffee **roasted** with ==care== and *love*\nsecond line";
		const html = L.md(md);
		expect(html).toContain("<b>roasted</b>");
		expect(html).toContain('<mark class="hl">care</mark>');
		expect(L.htmlToMd(html)).toBe(md);
		expect(L.md("<script>")).toBe("&lt;script&gt;");
	});
	test("setPath builds what is missing", () => {
		const s: Record<string, unknown> = {};
		L.setPath(s, "cards.1.title", "X");
		expect(Array.isArray(s.cards)).toBe(true);
		expect((s.cards as { title: string }[])[1].title).toBe("X");
	});
});

describe("slides", () => {
	test("every layout of the sample renders, and editable text carries its path", () => {
		const deck = D.normaliseDeck(sample, "brew-lab-pitch");
		expect(deck.slides.length).toBe(15);
		for (const [i, s] of deck.slides.entries()) {
			const html = L.slideHtml(
				s,
				ctx({ index: i, editable: true, footer: "F", showNumbers: true }),
			);
			expect(html).toContain(`L-${s.layout}`);
			if (s.title) expect(html).toContain('data-k="title"');
			expect(html).toContain('contenteditable="true"');
		}
	});
	test("every layout renders from its blank example too", () => {
		for (const k of Object.keys(L.LAYOUTS))
			expect(L.slideHtml({ layout: k }, ctx())).toContain(`L-${k}`);
	});
	test("theme variables do not break the style attribute", () => {
		const html = L.slideHtml({ layout: "title", title: "x" }, ctx());
		const style = /style="([^"]*)"/.exec(html)?.[1] || "";
		expect(style).toContain("--head:'fraunces'");
		expect(style).not.toContain('"');
		expect(style).toContain("background:");
	});
	test("unknown layouts fall back to points", () => {
		const d = D.normaliseDeck({ slides: [{ layout: "nope", title: "a" }] });
		expect(d.slides[0].layout).toBe("bullets");
		expect(D.normaliseDeck({}).slides[0].layout).toBe("title");
	});
});

describe("charts", () => {
	test("numbers and units", () => {
		expect(C.fmtNum(38, "€k")).toBe("€38k");
		expect(C.fmtNum(12500)).toBe("12.5k");
		expect(C.fmtNum(42, "%")).toBe("42%");
		expect(C.fmtNum(7, "users")).toBe("7 users");
	});
	test("every type draws", () => {
		for (const type of ["bar", "line", "area", "pie", "donut"]) {
			const svg = C.chartSvg(
				{
					type,
					labels: ["a", "b", "c"],
					series: [{ name: "s", values: [1, 3, 2] }],
				},
				800,
				400,
				{
					colours: ["#111", "#222"],
					text: "#000",
					muted: "#666",
					line: "#ddd",
					font: "Inter",
				},
			);
			expect(svg.startsWith("<svg")).toBe(true);
			expect(svg).not.toContain("NaN");
		}
		const h = C.chartSvg(
			{
				type: "bar",
				horizontal: true,
				stacked: true,
				labels: ["a"],
				series: [{ values: [1] }, { values: [2] }],
			},
			800,
			400,
			{
				colours: ["#111"],
				text: "#000",
				muted: "#666",
				line: "#ddd",
				font: "Inter",
			},
		);
		expect(h).toContain("<rect");
	});
});

describe("themes", () => {
	test("a brand becomes a theme", () => {
		const brand = {
			slug: "brew",
			spec: {
				name: "Brew Lab",
				palette: {
					primary: "#6B3A1E",
					secondary: "#C98B4A",
					accent: "#E8C07D",
					ink: "#1C1410",
					paper: "#FBF6EE",
				},
			},
			typography: {
				heading: { font: "sora", weight: 700 },
				body: { font: "inter" },
			},
		};
		const t = T.brandTheme(brand);
		expect(t.c.bg).toBe("#FBF6EE");
		expect(t.c.accent).toBe("#6B3A1E");
		expect(t.fonts.head[0]).toBe("sora");
		const dark = T.brandTheme(brand, { dark: true });
		expect(dark.dark).toBe(true);
		expect(dark.c.text).toBe("#FBF6EE");
	});
	test("every theme has its art and background", () => {
		for (const t of T.THEMES) {
			expect(A.backgroundCss(t, true)).toBeTruthy();
			expect(typeof A.artSvg(t, 1920, 1080, { index: 2, loud: true })).toBe(
				"string",
			);
		}
	});
});

describe("pictures and transitions", () => {
	test("where a picture goes", () => {
		expect(L.picPlacement({ layout: "bullets" })).toBe(null);
		expect(L.picPlacement({ layout: "bullets", image: "a.jpg" })).toBe("right");
		expect(L.picPlacement({ layout: "statement", image: "a.jpg" })).toBe(
			"background",
		);
		expect(
			L.picPlacement({ layout: "split", image: "a.jpg", side: "left" }),
		).toBe("left");
		expect(
			L.picPlacement({ layout: "cards", image: "a.jpg", imagePos: "left" }),
		).toBe("left");
		expect(L.picPlacement({ layout: "image", image: "a.jpg" })).toBe("full");
	});
	test("beside any layout, behind it with a shade, framed where the layout has a frame", () => {
		const side = L.slideHtml(
			{ layout: "cards", title: "T", cards: [{ title: "a" }], image: "p.jpg", imagePos: "left", imageFocus: "20% 70%", imageZoom: 1.5 },
			ctx({ resolve: (s: string) => `u/${s}` }),
		);
		expect(side).toContain("side-left");
		expect(side).toContain('class="sidepic"');
		expect(side).toContain("object-position:20% 70%");
		expect(side).toContain("scale(1.5)");
		const behind = L.slideHtml(
			{ layout: "split", title: "T", text: "x", image: "p.jpg", imagePos: "background", bgDim: 0.7 },
			ctx({ resolve: (s: string) => `u/${s}` }),
		);
		expect(behind).toContain('class="bgpic"');
		expect(behind).toContain("rgba(0,0,0,0.7)");
		expect(behind).toContain("--text:#fff");
		expect(behind).not.toContain("split-pic");
		expect(behind).not.toContain("pic-art");
		const framed = L.slideHtml(
			{ layout: "title", title: "T", image: "p.jpg", imagePos: "left" },
			ctx({ resolve: (s: string) => `u/${s}` }),
		);
		expect(framed).toContain("pic-left");
		expect(framed).toContain("title-pic");
	});
	test("items and pictures can be found on the slide", () => {
		const html = L.slideHtml(
			{ layout: "cards", title: "T", cards: [{ title: "a", icon: "rocket" }, { title: "b" }] },
			ctx({ editable: true }),
		);
		expect(html).toContain('data-item="cards.1"');
		expect(html).toContain('data-icon="cards.0.icon"');
		const team = L.slideHtml(
			{ layout: "team", title: "T", people: [{ name: "Ana" }] },
			ctx(),
		);
		expect(team).toContain('data-pic="people.0.image"');
	});
	test("a slide's transition, else the deck's, else fade", () => {
		expect(Tr.transitionOf({}, {})).toBe("fade");
		expect(Tr.transitionOf({ transition: "push" }, {})).toBe("push");
		expect(Tr.transitionOf({ transition: "push" }, { transition: "zoom" })).toBe("zoom");
		expect(Tr.transitionOf({ transition: "nope" }, {})).toBe("fade");
		expect(Tr.keyframes("none")).toEqual([null, null]);
		expect(Tr.PLAY_SOURCE).toContain("function keyframes");
	});
});
