/*
 * GRAPHS YOU CAN PLAY WITH: functions of x drawn in SVG with a grid and labelled axes, sliders for
 * every parameter (a, b, k ...), points, an area under a curve, and a readout that follows the
 * pointer. Drag to move, wheel or the buttons to zoom, double-click to reset. Discontinuities
 * (tan x, 1/x) break the line instead of drawing a wall.
 */
import { compile, namesIn } from "./expr.js";

const PALETTE = [
  "#4F46E5",
  "#E11D48",
  "#059669",
  "#D97706",
  "#0891B2",
  "#9333EA",
];

function niceStep(span, target = 8) {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

const fmt = (v) => {
  if (Math.abs(v) < 1e-10) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(1);
  return String(Number.parseFloat(v.toFixed(4)));
};

/** Sample y = f(x) over [x0, x1] into path segments, breaking at jumps and gaps. */
export function samplePath(f, x0, x1, y0, y1, w, h, n = 600) {
  const sx = (x) => ((x - x0) / (x1 - x0)) * w;
  const sy = (y) => h - ((y - y0) / (y1 - y0)) * h;
  const span = y1 - y0;
  let d = "";
  let pen = false;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    let y;
    try {
      y = f(x);
    } catch {
      y = Number.NaN;
    }
    if (
      !Number.isFinite(y) ||
      (prev !== null && Math.abs(y - prev) > span * 3)
    ) {
      pen = false;
      prev = Number.isFinite(y) ? y : null;
      if (!Number.isFinite(y)) continue;
    }
    const cy = Math.max(-h * 2, Math.min(h * 3, sy(y)));
    d += `${pen ? "L" : "M"}${sx(x).toFixed(1)} ${cy.toFixed(1)}`;
    pen = true;
    prev = y;
  }
  return d;
}

/**
 * Mount a graph into `el`. spec: { functions: [{expr, label, colour, dashed}], points: [{x, y, label}],
 * params: [{name, min, max, step, value, label}], x: [min,max], y: [min,max], area: {fn, from, to},
 * xLabel, yLabel, height, caption }
 */
export function mountGraph(el, spec = {}) {
  const fns = (spec.functions || []).map((f) =>
    typeof f === "string" ? { expr: f } : f,
  );
  // parameters: declared ones plus any free name in the expressions other than x
  const params = new Map();
  for (const p of spec.params || [])
    params.set(p.name, { min: -5, max: 5, step: 0.1, value: 1, ...p });
  for (const f of fns) {
    try {
      for (const n of namesIn(f.expr))
        if (n !== "x" && !params.has(n))
          params.set(n, { name: n, min: -5, max: 5, step: 0.1, value: 1 });
    } catch {
      /* shown as an error below */
    }
  }
  const names = ["x", ...params.keys()];
  const compiled = fns.map((f) => {
    try {
      return { ...f, fn: compile(f.expr, names), error: null };
    } catch (e) {
      return { ...f, fn: null, error: e.message };
    }
  });
  const home = {
    x: spec.x || [-10, 10],
    y: spec.y || null,
  };
  const view = { x: [...home.x], y: home.y ? [...home.y] : autoY() };
  const H = spec.height || 340;

  el.classList.add("graph");
  el.innerHTML = `<div class="graph-box"><svg class="graph-svg" role="img"></svg>
    <div class="graph-tools"><button type="button" data-z="in" title="Zoom in">+</button><button type="button" data-z="out" title="Zoom out">−</button><button type="button" data-z="home" title="Reset">⟲</button></div>
    <div class="graph-read"></div></div>
    <div class="graph-legend"></div><div class="graph-params"></div>`;
  const svg = el.querySelector("svg");
  const read = el.querySelector(".graph-read");

  function scope(x) {
    const s = { x };
    for (const [k, p] of params) s[k] = p.value;
    return s;
  }
  function autoY() {
    const ys = [];
    for (const f of compiled) {
      if (!f.fn) continue;
      for (let i = 0; i <= 200; i++) {
        const x = home.x[0] + ((home.x[1] - home.x[0]) * i) / 200;
        const y = f.fn(scope(x));
        if (Number.isFinite(y)) ys.push(y);
      }
    }
    for (const p of spec.points || []) ys.push(p.y);
    if (!ys.length) return [-10, 10];
    ys.sort((a, b) => a - b);
    let lo = ys[Math.floor(ys.length * 0.02)];
    let hi = ys[Math.ceil(ys.length * 0.98) - 1];
    if (hi - lo < 1e-6) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.15;
    lo -= pad;
    hi += pad;
    // keep the x axis in view when the curve sits close to it
    if (lo > 0 && lo < (hi - lo) * 0.6) lo = -pad;
    if (hi < 0 && -hi < (hi - lo) * 0.6) hi = pad;
    return [lo, hi];
  }

  function draw() {
    const W = el.querySelector(".graph-box").clientWidth || 600;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", H);
    const [x0, x1] = view.x;
    const [y0, y1] = view.y;
    const sx = (x) => ((x - x0) / (x1 - x0)) * W;
    const sy = (y) => H - ((y - y0) / (y1 - y0)) * H;
    let g = "";
    const stx = niceStep(x1 - x0, W / 70);
    const sty = niceStep(y1 - y0, H / 50);
    for (let x = Math.ceil(x0 / stx) * stx; x <= x1; x += stx)
      g += `<line x1="${sx(x)}" x2="${sx(x)}" y1="0" y2="${H}" class="gl"/>`;
    for (let y = Math.ceil(y0 / sty) * sty; y <= y1; y += sty)
      g += `<line y1="${sy(y)}" y2="${sy(y)}" x1="0" x2="${W}" class="gl"/>`;
    const ax = Math.max(0, Math.min(H, sy(0)));
    const ay = Math.max(0, Math.min(W, sx(0)));
    g += `<line x1="0" x2="${W}" y1="${ax}" y2="${ax}" class="ax"/><line y1="0" y2="${H}" x1="${ay}" x2="${ay}" class="ax"/>`;
    for (let x = Math.ceil(x0 / stx) * stx; x <= x1; x += stx)
      if (Math.abs(x) > stx / 2)
        g += `<text x="${sx(x)}" y="${Math.min(H - 4, ax + 14)}" class="tk" text-anchor="middle">${fmt(x)}</text>`;
    for (let y = Math.ceil(y0 / sty) * sty; y <= y1; y += sty)
      if (Math.abs(y) > sty / 2)
        g += `<text x="${Math.max(4, Math.min(W - 30, ay + 5))}" y="${sy(y) + 4}" class="tk">${fmt(y)}</text>`;
    if (spec.xLabel)
      g += `<text x="${W - 6}" y="${ax - 6}" class="al" text-anchor="end">${esc(spec.xLabel)}</text>`;
    if (spec.yLabel)
      g += `<text x="${ay + 6}" y="14" class="al">${esc(spec.yLabel)}</text>`;
    // area under a curve
    if (spec.area) {
      const f = compiled[spec.area.fn || 0];
      if (f?.fn) {
        const a = Math.max(x0, spec.area.from);
        const b = Math.min(x1, spec.area.to);
        let d = `M${sx(a)} ${sy(0)}`;
        for (let i = 0; i <= 200; i++) {
          const x = a + ((b - a) * i) / 200;
          const y = f.fn(scope(x));
          if (Number.isFinite(y))
            d += `L${sx(x).toFixed(1)} ${Math.max(-H, Math.min(2 * H, sy(y))).toFixed(1)}`;
        }
        d += `L${sx(b)} ${sy(0)}Z`;
        g += `<path d="${d}" fill="${f.colour || PALETTE[spec.area.fn || 0]}" opacity=".16"/>`;
      }
    }
    compiled.forEach((f, i) => {
      if (!f.fn) return;
      const d = samplePath((x) => f.fn(scope(x)), x0, x1, y0, y1, W, H);
      g += `<path d="${d}" fill="none" stroke="${f.colour || PALETTE[i % PALETTE.length]}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" ${f.dashed ? 'stroke-dasharray="7 6"' : ""}/>`;
    });
    for (const p of spec.points || []) {
      g += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="5" fill="${p.colour || "#111"}"/>`;
      if (p.label)
        g += `<text x="${sx(p.x) + 8}" y="${sy(p.y) - 8}" class="pl">${esc(p.label)}</text>`;
    }
    g += `<g class="hover"></g>`;
    svg.innerHTML = g;
  }

  // legend and sliders
  el.querySelector(".graph-legend").innerHTML = compiled
    .map(
      (f, i) =>
        `<span><i style="background:${f.colour || PALETTE[i % PALETTE.length]}"></i>${f.label ? esc(f.label) : `y = ${esc(f.expr)}`}${f.error ? ` <b class="bad">(${esc(f.error)})</b>` : ""}</span>`,
    )
    .join("");
  const pbox = el.querySelector(".graph-params");
  pbox.innerHTML = [...params.values()]
    .map(
      (p) =>
        `<label><span>${esc(p.label || p.name)} = <b data-v="${esc(p.name)}">${fmt(p.value)}</b></span><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" data-p="${esc(p.name)}"></label>`,
    )
    .join("");
  pbox.addEventListener("input", (e) => {
    const n = e.target.dataset.p;
    if (!n) return;
    params.get(n).value = Number(e.target.value);
    pbox.querySelector(`[data-v="${CSS.escape(n)}"]`).textContent = fmt(
      params.get(n).value,
    );
    draw();
  });

  // pan, zoom, readout
  let drag = null;
  const toWorld = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width;
    const py = (ev.clientY - r.top) / r.height;
    return {
      px,
      py,
      x: view.x[0] + px * (view.x[1] - view.x[0]),
      y: view.y[1] - py * (view.y[1] - view.y[0]),
    };
  };
  svg.addEventListener("pointerdown", (ev) => {
    drag = { at: toWorld(ev), x: [...view.x], y: [...view.y] };
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener("pointerup", () => {
    drag = null;
  });
  svg.addEventListener("pointermove", (ev) => {
    const w = toWorld(ev);
    if (drag) {
      const dx = (w.px - drag.at.px) * (drag.x[1] - drag.x[0]);
      const dy = (w.py - drag.at.py) * (drag.y[1] - drag.y[0]);
      view.x = [drag.x[0] - dx, drag.x[1] - dx];
      view.y = [drag.y[0] + dy, drag.y[1] + dy];
      draw();
      return;
    }
    const W = svg.viewBox.baseVal.width;
    const parts = [];
    let marks = "";
    compiled.forEach((f, i) => {
      if (!f.fn) return;
      const y = f.fn(scope(w.x));
      if (!Number.isFinite(y)) return;
      parts.push(
        `<span style="color:${f.colour || PALETTE[i % PALETTE.length]}">${fmt(y)}</span>`,
      );
      const cy = H - ((y - view.y[0]) / (view.y[1] - view.y[0])) * H;
      marks += `<circle cx="${w.px * W}" cy="${cy}" r="4.5" fill="#fff" stroke="${f.colour || PALETTE[i % PALETTE.length]}" stroke-width="2.5"/>`;
    });
    const hov = svg.querySelector(".hover");
    if (hov)
      hov.innerHTML = `<line x1="${w.px * W}" x2="${w.px * W}" y1="0" y2="${H}" class="cross"/>${marks}`;
    read.innerHTML = `x = ${fmt(w.x)}${parts.length ? ` · y = ${parts.join(" · ")}` : ""}`;
  });
  svg.addEventListener("pointerleave", () => {
    const hov = svg.querySelector(".hover");
    if (hov) hov.innerHTML = "";
    read.innerHTML = "";
  });
  const zoom = (
    k,
    cx = (view.x[0] + view.x[1]) / 2,
    cy = (view.y[0] + view.y[1]) / 2,
  ) => {
    view.x = [cx + (view.x[0] - cx) * k, cx + (view.x[1] - cx) * k];
    view.y = [cy + (view.y[0] - cy) * k, cy + (view.y[1] - cy) * k];
    draw();
  };
  svg.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const w = toWorld(ev);
      zoom(ev.deltaY > 0 ? 1.15 : 1 / 1.15, w.x, w.y);
    },
    { passive: false },
  );
  const reset = () => {
    view.x = [...home.x];
    view.y = home.y ? [...home.y] : autoY();
    draw();
  };
  svg.addEventListener("dblclick", reset);
  el.querySelector(".graph-tools").addEventListener("click", (e) => {
    const z = e.target.dataset.z;
    if (z === "in") zoom(1 / 1.4);
    if (z === "out") zoom(1.4);
    if (z === "home") reset();
  });
  new ResizeObserver(() => draw()).observe(el.querySelector(".graph-box"));
  draw();
  return { redraw: draw };
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
