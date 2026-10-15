/*
 * COURSE COVERS: an abstract pattern in the course's colour, different for every course (seeded by
 * its slug), with a symbol for the subject. Drawn as SVG so it is sharp at every size.
 */

const GLYPHS = [
  [/math|algebra|geometr|calcul|matem/i, "∑"],
  [/physic|fizik/i, "⚛"],
  [/chem|hemij/i, "⚗"],
  [/bio/i, "❀"],
  [/geograph|geograf/i, "◍"],
  [/histor|istorij/i, "⌛"],
  [/econom|ekonom|financ/i, "$"],
  [/language|english|engle|french|german|spanish|jezik|srpsk/i, "Aa"],
  [/literat|knjiž/i, "❝"],
  [/program|comput|coding|informat/i, "</>"],
  [/music|muzi/i, "♪"],
  [/art|likov/i, "✎"],
  [/philosoph|filozof/i, "?"],
  [/psych|psiholog/i, "◐"],
  [/astro|space|svemir/i, "✦"],
];

export function glyphFor(course) {
  const s = `${course.subject || ""} ${course.title || ""}`;
  for (const [re, g] of GLYPHS) if (re.test(s)) return g;
  return (course.title || "?").trim().charAt(0).toUpperCase();
}

function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const f = (v) =>
    Math.max(
      0,
      Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))),
    );
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

/** An SVG cover, w x h, for a course. */
export function coverSvg(course, w = 320, h = 180, { glyph = true } = {}) {
  const r = rng(course.slug || course.title);
  const c = course.colour || "#4F46E5";
  const light = shade(c, 0.35);
  const lighter = shade(c, 0.62);
  const dark = shade(c, -0.25);
  const kind = Math.floor(r() * 3);
  let shapes = "";
  if (kind === 0) {
    // circles
    for (let i = 0; i < 7; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 20 + r() * 70;
      shapes += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(0)}" fill="${[light, lighter, dark][i % 3]}" opacity="${(0.35 + r() * 0.4).toFixed(2)}"/>`;
    }
  } else if (kind === 1) {
    // diagonal bands and triangles
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * w * 1.4 - w * 0.2 + r() * 30;
      shapes += `<path d="M${x.toFixed(0)} ${h} L${(x + 60 + r() * 60).toFixed(0)} 0 L${(x + 110 + r() * 60).toFixed(0)} 0 L${(x + 50 + r() * 50).toFixed(0)} ${h}Z" fill="${[light, lighter, dark][i % 3]}" opacity="${(0.25 + r() * 0.35).toFixed(2)}"/>`;
    }
  } else {
    // grid of dots and arcs
    for (let y = 18; y < h; y += 26)
      for (let x = 18; x < w; x += 26)
        if (r() > 0.45)
          shapes += `<circle cx="${x}" cy="${y}" r="${(2 + r() * 3).toFixed(1)}" fill="${lighter}" opacity=".55"/>`;
    for (let i = 0; i < 3; i++) {
      const rad = 50 + r() * 90;
      shapes += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${rad.toFixed(0)}" fill="none" stroke="${light}" stroke-width="${(8 + r() * 18).toFixed(0)}" opacity=".45"/>`;
    }
  }
  const g = glyph ? glyphFor(course) : "";
  const size = g.length > 2 ? h * 0.32 : g.length > 1 ? h * 0.42 : h * 0.56;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${c}"/>${shapes}${
    g
      ? `<text x="${w - 22}" y="${h - 22}" text-anchor="end" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="${size.toFixed(0)}" fill="#fff" opacity=".92">${g.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`
      : ""
  }</svg>`;
}
