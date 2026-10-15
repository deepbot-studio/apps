/*
 * THEMES: a deck's whole look in one object - two fonts from the bundled catalogue, a palette, how
 * headings are set, the background, the cards and the decoration. Every slide reads only these, so
 * changing the theme restyles the whole deck, and a brand from the Logo designer becomes a theme.
 */

export const THEMES = [
	{
		id: "paper",
		name: "Paper",
		dark: false,
		fonts: { head: ["fraunces", 700], body: ["inter", 400] },
		c: {
			bg: "#F7F3EC",
			bg2: "#EFE8DC",
			surface: "#FFFFFF",
			text: "#1F1A14",
			muted: "#6E6457",
			accent: "#C2562F",
			accent2: "#2F5D50",
			accent3: "#D9A441",
			line: "#E3D9C9",
		},
		head: { case: "none", tracking: -0.02 },
		radius: 18,
		bg: "paper",
		art: "rings",
		card: "flat",
	},
	{
		id: "midnight",
		name: "Midnight",
		dark: true,
		fonts: { head: ["sora", 700], body: ["inter", 400] },
		c: {
			bg: "#0B1020",
			bg2: "#131A33",
			surface: "#161E3A",
			text: "#EEF2FF",
			muted: "#94A0C4",
			accent: "#4CC9F0",
			accent2: "#7B61FF",
			accent3: "#F72585",
			line: "#26304F",
		},
		head: { case: "none", tracking: -0.02 },
		radius: 20,
		bg: "glow",
		art: "orbits",
		card: "glass",
	},
	{
		id: "aurora",
		name: "Aurora",
		dark: true,
		fonts: { head: ["space-grotesk", 700], body: ["inter", 400] },
		c: {
			bg: "#08070F",
			bg2: "#14112A",
			surface: "#1A1730",
			text: "#FFFFFF",
			muted: "#B5AED6",
			accent: "#A78BFA",
			accent2: "#34D399",
			accent3: "#F472B6",
			line: "#2C2750",
		},
		head: { case: "none", tracking: -0.03 },
		radius: 24,
		bg: "mesh",
		art: "none",
		card: "glass",
	},
	{
		id: "swiss",
		name: "Swiss",
		dark: false,
		fonts: { head: ["inter", 800], body: ["inter", 400] },
		c: {
			bg: "#FFFFFF",
			bg2: "#F2F2F2",
			surface: "#F5F5F5",
			text: "#111111",
			muted: "#6B6B6B",
			accent: "#E30613",
			accent2: "#111111",
			accent3: "#9A9A9A",
			line: "#DDDDDD",
		},
		head: { case: "none", tracking: -0.04 },
		radius: 0,
		bg: "plain",
		art: "grid",
		card: "rule",
	},
	{
		id: "forest",
		name: "Forest",
		dark: true,
		fonts: { head: ["cormorant", 700], body: ["manrope", 400] },
		c: {
			bg: "#10231C",
			bg2: "#173026",
			surface: "#1C392D",
			text: "#F3EEDF",
			muted: "#B4B7A2",
			accent: "#D4AF6A",
			accent2: "#8FBF9F",
			accent3: "#E7D7B0",
			line: "#2C4A3C",
		},
		head: { case: "none", tracking: -0.01 },
		radius: 14,
		bg: "vignette",
		art: "leaves",
		card: "outline",
	},
	{
		id: "citrus",
		name: "Citrus",
		dark: false,
		fonts: { head: ["bricolage", 800], body: ["outfit", 400] },
		c: {
			bg: "#FFF8E7",
			bg2: "#FFEFC2",
			surface: "#FFFFFF",
			text: "#1D1A12",
			muted: "#6D6450",
			accent: "#FF6B1A",
			accent2: "#2E9E6B",
			accent3: "#FFC21A",
			line: "#F1E2B8",
		},
		head: { case: "none", tracking: -0.03 },
		radius: 28,
		bg: "plain",
		art: "blobs",
		card: "shadow",
	},
	{
		id: "mono",
		name: "Mono",
		dark: false,
		fonts: { head: ["syne", 800], body: ["space-mono", 400] },
		c: {
			bg: "#F4F4F0",
			bg2: "#E8E8E2",
			surface: "#FFFFFF",
			text: "#0A0A0A",
			muted: "#5A5A55",
			accent: "#0A0A0A",
			accent2: "#0A0A0A",
			accent3: "#8A8A85",
			line: "#0A0A0A",
		},
		head: { case: "upper", tracking: -0.01 },
		radius: 0,
		bg: "plain",
		art: "lines",
		card: "outline",
	},
	{
		id: "pastel",
		name: "Pastel",
		dark: false,
		fonts: { head: ["quicksand", 700], body: ["poppins", 400] },
		c: {
			bg: "#FBF7FF",
			bg2: "#F1E9FF",
			surface: "#FFFFFF",
			text: "#2B2340",
			muted: "#7A7090",
			accent: "#8B5CF6",
			accent2: "#F472B6",
			accent3: "#38BDF8",
			line: "#E9DFFA",
		},
		head: { case: "none", tracking: -0.01 },
		radius: 26,
		bg: "soft",
		art: "blobs",
		card: "shadow",
	},
	{
		id: "corporate",
		name: "Corporate",
		dark: false,
		fonts: { head: ["montserrat", 700], body: ["manrope", 400] },
		c: {
			bg: "#FFFFFF",
			bg2: "#F3F6FB",
			surface: "#F6F8FC",
			text: "#0F1E36",
			muted: "#5B6B84",
			accent: "#1F5EFF",
			accent2: "#0EA5A4",
			accent3: "#F59E0B",
			line: "#DFE6F1",
		},
		head: { case: "none", tracking: -0.02 },
		radius: 12,
		bg: "band",
		art: "none",
		card: "outline",
	},
	{
		id: "noir",
		name: "Noir",
		dark: true,
		fonts: { head: ["playfair", 700], body: ["inter", 400] },
		c: {
			bg: "#0D0D0D",
			bg2: "#171717",
			surface: "#1B1B1B",
			text: "#F5F1E8",
			muted: "#A39E93",
			accent: "#D6B98C",
			accent2: "#F5F1E8",
			accent3: "#8C7A5B",
			line: "#2B2B2B",
		},
		head: { case: "none", tracking: -0.01 },
		radius: 4,
		bg: "plain",
		art: "frame",
		card: "rule",
	},
	{
		id: "ocean",
		name: "Ocean",
		dark: false,
		fonts: { head: ["outfit", 700], body: ["outfit", 400] },
		c: {
			bg: "#F1FAFB",
			bg2: "#DDF2F4",
			surface: "#FFFFFF",
			text: "#05323A",
			muted: "#4D7279",
			accent: "#0E8C9B",
			accent2: "#0B4F6C",
			accent3: "#F4A259",
			line: "#CDE8EB",
		},
		head: { case: "none", tracking: -0.02 },
		radius: 22,
		bg: "wave",
		art: "waves",
		card: "shadow",
	},
	{
		id: "brutal",
		name: "Brutal",
		dark: false,
		fonts: { head: ["archivo-black", 400], body: ["space-grotesk", 400] },
		c: {
			bg: "#FFF4E0",
			bg2: "#FFE7BA",
			surface: "#FFFFFF",
			text: "#000000",
			muted: "#3C3C3C",
			accent: "#FF5C39",
			accent2: "#3D5AFE",
			accent3: "#00C48C",
			line: "#000000",
		},
		head: { case: "upper", tracking: -0.01 },
		radius: 10,
		bg: "plain",
		art: "stickers",
		card: "brutal",
	},
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

function mix(hex, other, t) {
	const p = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
	const a = p(hex);
	const b = p(other);
	return `#${a
		.map((v, i) =>
			Math.round(v + (b[i] - v) * t)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A theme from a Logo designer brand (brands/<slug>/brand.json): its palette and type pairing, on a
 * base theme for everything else. `dark` puts it on the brand's darkest colour.
 */
export function brandTheme(brand, { dark = false, base = "paper" } = {}) {
	const b = themeById(base);
	const pal = brand?.spec?.palette || {};
	const ink = pal.ink || "#151515";
	const paper = pal.paper || "#FFFFFF";
	const primary = pal.primary || b.c.accent;
	const secondary = pal.secondary || b.c.accent2;
	const accent = pal.accent || b.c.accent3;
	const head = brand?.typography?.heading || {};
	const body = brand?.typography?.body || {};
	const bg = dark ? (luminance(primary) < 0.12 ? primary : ink) : paper;
	const text = dark ? paper : ink;
	return {
		...b,
		id: `brand:${brand?.slug || "brand"}${dark ? ":dark" : ""}`,
		name: `${brand?.spec?.name || "Brand"}${dark ? " (dark)" : ""}`,
		brand: brand?.slug || null,
		dark,
		fonts: {
			head: [head.font || b.fonts.head[0], head.weight || 700],
			body: [body.font || b.fonts.body[0], body.weight || 400],
		},
		c: {
			bg,
			bg2: mix(bg, dark ? "#ffffff" : primary, dark ? 0.06 : 0.06),
			surface: dark ? mix(bg, "#ffffff", 0.08) : "#FFFFFF",
			text,
			muted: mix(text, bg, 0.4),
			accent: dark && luminance(primary) < 0.12 ? accent : primary,
			accent2: secondary,
			accent3: accent,
			line: mix(bg, text, 0.14),
		},
		art: "rings",
		bg: dark ? "glow" : "paper",
		card: "flat",
	};
}

/** The CSS variables a slide needs from a theme. */
export function themeVars(t, catalogue) {
	const fam = (id) => catalogue?.find((f) => f.id === id)?.family || id;
	const c = t.c;
	return {
		"--bg": c.bg,
		"--bg2": c.bg2,
		"--surface": c.surface,
		"--text": c.text,
		"--muted": c.muted,
		"--accent": c.accent,
		"--accent2": c.accent2,
		"--accent3": c.accent3,
		"--line": c.line,
		"--on-accent": luminance(c.accent) > 0.4 ? "#111111" : "#FFFFFF",
		"--radius": `${t.radius}px`,
		"--head": `'${fam(t.fonts.head[0])}', 'Inter', system-ui, sans-serif`,
		"--head-w": String(t.fonts.head[1]),
		"--body": `'${fam(t.fonts.body[0])}', 'Inter', system-ui, sans-serif`,
		"--body-w": String(t.fonts.body[1]),
		"--head-case": t.head.case === "upper" ? "uppercase" : "none",
		"--head-track": `${t.head.tracking}em`,
	};
}

/** @font-face rules for the fonts a theme uses (all weights the catalogue has for them). */
export function fontFaces(themes, catalogue, base = "fonts/") {
	const ids = new Set();
	for (const t of themes) {
		ids.add(t.fonts.head[0]);
		ids.add(t.fonts.body[0]);
	}
	ids.add("inter");
	let css = "";
	for (const id of ids) {
		const f = catalogue?.find((x) => x.id === id);
		if (!f) continue;
		for (const [w, file] of Object.entries(f.files))
			css += `@font-face{font-family:"${f.family}";font-weight:${w};src:url(${base}${file});font-display:block}\n`;
	}
	return css;
}

export { luminance, mix };
