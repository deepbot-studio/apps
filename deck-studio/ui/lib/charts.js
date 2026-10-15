/*
 * CHARTS ON SLIDES: bar (grouped or stacked, upright or lying), line, area, pie and donut, drawn as
 * SVG in the theme's colours with values on them, so a slide reads from the back of the room. The
 * same data goes into PowerPoint as a native chart on export.
 */

const esc = (s) =>
	String(s ?? "").replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
	);

export function fmtNum(v, unit = "") {
	if (!Number.isFinite(v)) return "";
	const a = Math.abs(v);
	let s;
	if (a >= 1e9) s = `${+(v / 1e9).toFixed(1)}B`;
	else if (a >= 1e6) s = `${+(v / 1e6).toFixed(1)}M`;
	else if (a >= 1e4) s = `${+(v / 1e3).toFixed(1)}k`;
	else s = String(+v.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return unit === "%"
		? `${s}%`
		: unit
			? /^[$€£¥]/.test(unit)
				? `${unit[0]}${s}${unit.slice(1)}` // "€k" -> €38k
				: /^[kKmMbB%]$/.test(unit)
					? `${s}${unit}`
					: `${s} ${unit}`
			: s;
}

function niceMax(v) {
	if (v <= 0) return 1;
	const p = 10 ** Math.floor(Math.log10(v));
	const m = v / p;
	return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Normalise chart data: { type, labels, series: [{name, values}], unit, stacked, horizontal }. */
export function chartData(chart = {}) {
	const labels = (chart.labels || []).map(String);
	let series = chart.series || [];
	if (!series.length && Array.isArray(chart.values))
		series = [{ name: chart.name || "", values: chart.values }];
	series = series.map((s, i) => ({
		name: s.name || `Series ${i + 1}`,
		values: labels.map((_, j) => Number(s.values?.[j]) || 0),
	}));
	return {
		type: chart.type || "bar",
		labels,
		series,
		unit: chart.unit || "",
		stacked: !!chart.stacked,
		horizontal: !!chart.horizontal,
	};
}

/**
 * SVG for a chart in a w x h box. colours: the theme's palette in order; text/muted/line: theme colours.
 */
export function chartSvg(chart, w, h, { colours, text, muted, line, font }) {
	const d = chartData(chart);
	const fs = Math.max(16, Math.round(Math.min(w, h) / 22));
	const t = (
		x,
		y,
		s,
		{ anchor = "middle", size = fs, fill = muted, weight = 400 } = {},
	) =>
		`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;
	const col = (i) => colours[i % colours.length];
	let body = "";
	let legend = "";
	if (d.series.length > 1 && d.type !== "pie" && d.type !== "donut") {
		let x = 0;
		legend = d.series
			.map((s, i) => {
				const item = `<rect x="${x}" y="${-fs * 0.8}" width="${fs * 0.8}" height="${fs * 0.8}" rx="3" fill="${col(i)}"/>${t(x + fs * 1.2, 0, s.name, { anchor: "start", fill: text })}`;
				x += fs * 1.6 + s.name.length * fs * 0.58 + fs;
				return item;
			})
			.join("");
		legend = `<g transform="translate(0 ${fs})">${legend}</g>`;
	}
	const top = legend ? fs * 2.4 : fs * 0.6;

	if (d.type === "pie" || d.type === "donut") {
		const vals = d.series[0]?.values || [];
		const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
		const r = Math.min(h * 0.46, w * 0.28);
		const cx = r + 10;
		const cy = h / 2;
		let a0 = -Math.PI / 2;
		vals.forEach((v, i) => {
			const a1 = a0 + (Math.max(0, v) / total) * Math.PI * 2;
			const large = a1 - a0 > Math.PI ? 1 : 0;
			const p = (a, rr) =>
				`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
			if (vals.length === 1 || v >= total)
				body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col(i)}"/>`;
			else
				body += `<path d="M${cx} ${cy} L${p(a0, r)} A${r} ${r} 0 ${large} 1 ${p(a1, r)} Z" fill="${col(i)}" stroke="${chart.bg || "#fff"}" stroke-width="3"/>`;
			const mid = (a0 + a1) / 2;
			const share = Math.round((Math.max(0, v) / total) * 100);
			if (share >= 6)
				body += t(
					cx + r * 0.68 * Math.cos(mid),
					cy + r * 0.68 * Math.sin(mid) + fs * 0.35,
					`${share}%`,
					{ fill: "#fff", weight: 700, size: fs * 1.05 },
				);
			a0 = a1;
		});
		if (d.type === "donut") {
			body += `<circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="${chart.bg || "#fff"}"/>`;
			if (chart.center)
				body += t(cx, cy + fs * 0.5, chart.center, {
					fill: text,
					weight: 700,
					size: fs * 1.8,
				});
		}
		// legend on the right
		const lx = cx + r + 40;
		const step = Math.min(fs * 2.1, (h - 20) / Math.max(1, vals.length));
		const ly = cy - (step * (vals.length - 1)) / 2;
		vals.forEach((v, i) => {
			body += `<rect x="${lx}" y="${ly + i * step - fs * 0.75}" width="${fs}" height="${fs}" rx="4" fill="${col(i)}"/>`;
			body += t(lx + fs * 1.6, ly + i * step + fs * 0.1, d.labels[i] || "", {
				anchor: "start",
				fill: text,
			});
			body += t(w - 4, ly + i * step + fs * 0.1, fmtNum(v, d.unit), {
				anchor: "end",
				fill: muted,
				weight: 600,
			});
		});
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
	}

	const n = d.labels.length || 1;
	const sums = d.labels.map((_, j) =>
		d.series.reduce((a, s) => a + Math.max(0, s.values[j]), 0),
	);
	const maxV = niceMax(
		d.stacked
			? Math.max(...sums, 0)
			: Math.max(...d.series.flatMap((s) => s.values), 0),
	);
	const minV = Math.min(0, ...d.series.flatMap((s) => s.values));
	const span = maxV - minV || 1;

	if (d.type === "bar" && d.horizontal) {
		const labelW = Math.min(
			w * 0.32,
			Math.max(...d.labels.map((l) => l.length)) * fs * 0.56 + 10,
		);
		const x0 = labelW + 12;
		const pw = w - x0 - fs * 4;
		const rowH = (h - top) / n;
		const bh = Math.min(rowH * 0.62, fs * 2.2);
		d.labels.forEach((l, j) => {
			const y = top + rowH * j + (rowH - bh) / 2;
			body += t(labelW, y + bh / 2 + fs * 0.35, l, {
				anchor: "end",
				fill: text,
			});
			let acc = 0;
			d.series.forEach((s, i) => {
				const v = Math.max(0, s.values[j]);
				const len = (v / maxV) * pw;
				const yy = d.stacked ? y : y + (bh / d.series.length) * i;
				const hh = d.stacked ? bh : bh / d.series.length - 2;
				body += `<rect x="${x0 + (d.stacked ? acc : 0)}" y="${yy}" width="${Math.max(2, len)}" height="${hh}" rx="${Math.min(6, hh / 3)}" fill="${col(i)}"/>`;
				if (!d.stacked || i === d.series.length - 1)
					body += t(
						x0 + (d.stacked ? acc : 0) + len + 8,
						yy + hh / 2 + fs * 0.35,
						fmtNum(d.stacked ? sums[j] : v, d.unit),
						{ anchor: "start", fill: text, weight: 600 },
					);
				acc += len;
			});
		});
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${legend}${body}</svg>`;
	}

	const x0 = fs * 3.4;
	const bottom = h - fs * 2;
	const ph = bottom - top;
	const pw = w - x0 - 10;
	const Y = (v) => bottom - ((v - minV) / span) * ph;
	// grid
	for (let k = 0; k <= 4; k++) {
		const v = minV + (span * k) / 4;
		body += `<line x1="${x0}" x2="${w}" y1="${Y(v)}" y2="${Y(v)}" stroke="${line}" stroke-width="${v === 0 ? 2 : 1}"/>`;
		body += t(x0 - 10, Y(v) + fs * 0.35, fmtNum(v, d.unit), {
			anchor: "end",
			size: fs * 0.85,
		});
	}
	const slot = pw / n;
	d.labels.forEach((l, j) => {
		body += t(x0 + slot * (j + 0.5), h - fs * 0.5, l, {
			size: n > 8 ? fs * 0.8 : fs,
		});
	});
	if (d.type === "bar") {
		const gw = slot * 0.7;
		d.labels.forEach((_, j) => {
			let acc = 0;
			d.series.forEach((s, i) => {
				const v = s.values[j];
				const bw = d.stacked ? gw : gw / d.series.length;
				const x = x0 + slot * j + (slot - gw) / 2 + (d.stacked ? 0 : bw * i);
				const y1 = d.stacked ? Y(acc + Math.max(0, v)) : Y(Math.max(0, v));
				const y2 = d.stacked ? Y(acc) : Y(Math.min(0, v));
				body += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${(bw - (d.stacked ? 0 : 4)).toFixed(1)}" height="${Math.max(2, y2 - y1).toFixed(1)}" rx="${Math.min(8, bw / 6).toFixed(1)}" fill="${col(i)}"/>`;
				if (
					(!d.stacked && d.series.length <= 2 && n <= 12) ||
					(d.stacked && i === d.series.length - 1)
				)
					body += t(
						x + (bw - 4) / 2,
						y1 - 8,
						fmtNum(d.stacked ? sums[j] : v, d.unit),
						{ fill: text, weight: 600, size: fs * 0.9 },
					);
				acc += Math.max(0, v);
			});
		});
	} else {
		d.series.forEach((s, i) => {
			const pts = s.values.map((v, j) => [x0 + slot * (j + 0.5), Y(v)]);
			const path = pts
				.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
				.join("");
			if (d.type === "area")
				body += `<path d="${path}L${pts.at(-1)[0]} ${Y(Math.max(0, minV))}L${pts[0][0]} ${Y(Math.max(0, minV))}Z" fill="${col(i)}" opacity="${d.series.length > 1 ? 0.25 : 0.18}"/>`;
			body += `<path d="${path}" fill="none" stroke="${col(i)}" stroke-width="${fs * 0.28}" stroke-linejoin="round" stroke-linecap="round"/>`;
			pts.forEach(([x, y], k) => {
				body += `<circle cx="${x}" cy="${y}" r="${fs * 0.36}" fill="${chart.bg || "#fff"}" stroke="${col(i)}" stroke-width="${fs * 0.2}"/>`;
				if (d.series.length === 1 && (n <= 8 || k === n - 1))
					body += t(x, y - fs * 0.9, fmtNum(s.values[k], d.unit), {
						fill: text,
						weight: 600,
						size: fs * 0.9,
					});
			});
		});
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${legend}${body}</svg>`;
}
