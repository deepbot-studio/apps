/*
 * DECORATION: the background and the quiet shapes that make a theme feel designed - rings on paper,
 * a glow at midnight, a mesh of colour, a Swiss grid, leaves, blobs, waves, stickers. Seeded by the
 * slide's place in the deck, so slides differ but a deck stays one family. Title and section slides
 * get more; content slides get a touch, never behind the text.
 */

function rng(seed) {
	let s = (seed * 2654435761) >>> 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return (s >>> 0) / 4294967296;
	};
}

/** CSS background for a slide. `loud`: a title, section or closing slide. */
export function backgroundCss(t, loud) {
	const c = t.c;
	switch (t.bg) {
		case "glow":
			return `radial-gradient(1200px 800px at 85% 10%, ${c.accent2}55, transparent 60%), radial-gradient(900px 700px at 0% 100%, ${c.accent}33, transparent 60%), ${c.bg}`;
		case "mesh":
			return `radial-gradient(700px 600px at 15% 20%, ${c.accent}66, transparent 60%), radial-gradient(800px 700px at 85% 30%, ${c.accent3}55, transparent 60%), radial-gradient(900px 700px at 60% 100%, ${c.accent2}55, transparent 60%), ${c.bg}`;
		case "vignette":
			return `radial-gradient(1400px 900px at 50% 40%, ${c.bg2}, ${c.bg} 70%)`;
		case "soft":
			return `radial-gradient(900px 700px at 100% 0%, ${c.accent2}22, transparent 60%), radial-gradient(900px 700px at 0% 100%, ${c.accent3}22, transparent 60%), ${c.bg}`;
		case "wave":
			return `linear-gradient(180deg, ${c.bg} 0%, ${c.bg2} 100%)`;
		case "band":
			return loud
				? `linear-gradient(135deg, ${c.accent} 0%, ${c.accent2} 100%)`
				: c.bg;
		case "paper":
			return `radial-gradient(1200px 900px at 20% 0%, ${c.bg} 0%, ${c.bg2} 100%)`;
		default:
			return c.bg;
	}
}

/** An SVG layer of decoration for a W x H slide (or "" for none). */
export function artSvg(t, W, H, { index = 0, loud = false } = {}) {
	const r = rng(index + 7);
	const c = t.c;
	let g = "";
	switch (t.art) {
		case "rings": {
			const n = loud ? 3 : 1;
			for (let i = 0; i < n; i++) {
				const rad = (loud ? 260 : 180) + r() * 260;
				const x = loud ? W * (0.7 + r() * 0.35) : W + 40;
				const y = loud ? H * (r() * 1.0) : -40;
				g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(0)}" fill="none" stroke="${[c.accent, c.accent2, c.accent3][i % 3]}" stroke-width="${loud ? 3 : 2}" opacity="${loud ? 0.35 : 0.25}"/>`;
			}
			if (loud)
				g += `<circle cx="${(W * 0.86).toFixed(0)}" cy="${(H * 0.72).toFixed(0)}" r="120" fill="${c.accent}" opacity=".9"/>`;
			break;
		}
		case "orbits": {
			const cx = W * 0.92;
			const cy = H * 0.08;
			for (let i = 1; i <= (loud ? 5 : 2); i++)
				g += `<circle cx="${cx}" cy="${cy}" r="${i * 150}" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="${0.28 - i * 0.03}"/>`;
			if (loud)
				for (let i = 0; i < 4; i++) {
					const a = Math.PI * (0.5 + r() * 0.5);
					const rad = 150 * (2 + i);
					g += `<circle cx="${(cx + rad * Math.cos(a)).toFixed(0)}" cy="${(cy + rad * Math.sin(a)).toFixed(0)}" r="${6 + r() * 6}" fill="${[c.accent, c.accent2, c.accent3][i % 3]}"/>`;
				}
			break;
		}
		case "grid": {
			const step = 120;
			for (let x = step; x < W; x += step)
				g += `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="${c.line}" stroke-width="1" opacity=".55"/>`;
			if (loud)
				g += `<rect x="${W - 240}" y="0" width="240" height="${H}" fill="${c.accent}"/>`;
			else
				g += `<rect x="0" y="0" width="${W}" height="10" fill="${c.accent}"/>`;
			break;
		}
		case "leaves": {
			const n = loud ? 5 : 2;
			for (let i = 0; i < n; i++) {
				const x = W - 80 - r() * (loud ? 520 : 200);
				const y = loud ? r() * H : H - 40 - r() * 160;
				const s = (loud ? 1.6 : 0.9) + r() * 0.8;
				const rot = -60 + r() * 120;
				g += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${rot.toFixed(0)}) scale(${s.toFixed(2)})" opacity="${loud ? 0.5 : 0.28}"><path d="M0 0 C40 -60 120 -60 160 0 C120 60 40 60 0 0 Z" fill="none" stroke="${c.accent}" stroke-width="2"/><path d="M0 0 L160 0" stroke="${c.accent}" stroke-width="1.5"/></g>`;
			}
			break;
		}
		case "blobs": {
			const n = loud ? 3 : 1;
			for (let i = 0; i < n; i++) {
				const cx = loud ? W * (0.65 + r() * 0.4) : W - 60;
				const cy = loud ? H * r() : H - 40;
				const rad = loud ? 220 + r() * 200 : 160;
				let d = "";
				const k = 7;
				for (let j = 0; j <= k; j++) {
					const a = (j / k) * Math.PI * 2;
					const rr = rad * (0.82 + r() * 0.3);
					d += `${j ? "L" : "M"}${(cx + rr * Math.cos(a)).toFixed(0)} ${(cy + rr * Math.sin(a)).toFixed(0)}`;
				}
				g += `<path d="${d}Z" fill="${[c.accent3, c.accent, c.accent2][i % 3]}" opacity="${loud ? 0.85 : 0.25}" stroke="${[c.accent3, c.accent, c.accent2][i % 3]}" stroke-width="80" stroke-linejoin="round"/>`;
			}
			break;
		}
		case "lines": {
			const n = loud ? 14 : 4;
			for (let i = 0; i < n; i++)
				g += `<line x1="${W - 60 - i * 26}" x2="${W - 60 - i * 26}" y1="${loud ? 0 : H - 120}" y2="${H}" stroke="${c.text}" stroke-width="2"/>`;
			break;
		}
		case "frame":
			g += `<rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="${loud ? 0.9 : 0.45}"/>`;
			if (loud)
				g += `<rect x="52" y="52" width="${W - 104}" height="${H - 104}" fill="none" stroke="${c.accent}" stroke-width="0.8" opacity=".5"/>`;
			break;
		case "waves": {
			const n = loud ? 4 : 2;
			for (let i = 0; i < n; i++) {
				const y0 = H - 40 - i * (loud ? 60 : 30);
				const amp = 26 + i * 8;
				let d = `M0 ${y0}`;
				for (let x = 0; x <= W; x += 40)
					d += `L${x} ${(y0 + amp * Math.sin(x / 180 + i * 1.3)).toFixed(1)}`;
				d += `L${W} ${H}L0 ${H}Z`;
				g += `<path d="${d}" fill="${[c.accent, c.accent2, c.accent3, c.accent][i]}" opacity="${loud ? 0.22 + i * 0.06 : 0.12}"/>`;
			}
			break;
		}
		case "stickers": {
			if (!loud) {
				g += `<rect x="${W - 150}" y="40" width="90" height="90" rx="14" fill="${c.accent3}" stroke="#000" stroke-width="5" transform="rotate(12 ${W - 105} 85)"/>`;
				break;
			}
			const shapes = [
				`<circle cx="0" cy="0" r="90" fill="${c.accent}" stroke="#000" stroke-width="6"/>`,
				`<rect x="-80" y="-80" width="160" height="160" rx="18" fill="${c.accent2}" stroke="#000" stroke-width="6"/>`,
				`<path d="M0 -100 L28 -30 L100 -30 L42 14 L64 86 L0 42 L-64 86 L-42 14 L-100 -30 L-28 -30 Z" fill="${c.accent3}" stroke="#000" stroke-width="6" stroke-linejoin="round"/>`,
			];
			shapes.forEach((s, i) => {
				g += `<g transform="translate(${(W * (0.66 + i * 0.12)).toFixed(0)} ${(H * (0.25 + r() * 0.5)).toFixed(0)}) rotate(${(-20 + r() * 40).toFixed(0)})">${s}</g>`;
			});
			break;
		}
		default:
			break;
	}
	if (t.bg === "band" && !loud)
		g += `<rect x="0" y="0" width="14" height="${H}" fill="${c.accent}"/>`;
	return g
		? `<svg class="art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none">${g}</svg>`
		: "";
}
