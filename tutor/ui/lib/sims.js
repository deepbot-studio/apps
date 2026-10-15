/*
 * SIMULATIONS: small worlds to change and watch, each with sliders, play / pause / reset and live
 * figures. Physics (projectile, pendulum, spring, waves, circuit, orbit), biology (population growth),
 * economics (supply and demand), probability (dice) and, for the youngest, fractions. A lesson asks
 * for one by name with starting values: { "type": "sim", "sim": "projectile", "params": { "angle": 30 } }.
 */

const TAU = Math.PI * 2;

function css(name, fallback) {
  try {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

const fmt = (v, d = 2) =>
  Number.isFinite(v)
    ? Number.parseFloat(v.toFixed(d)).toLocaleString("en")
    : "-";

function arrow(ctx, x0, y0, x1, y1, colour, w = 2.5) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
}

function label(ctx, text, x, y, colour = "#334155", size = 13, align = "left") {
  ctx.fillStyle = colour;
  ctx.font = `600 ${size}px Lexend, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

/* Each sim: title, params, optional reset(state, p), step(state, p, dt), draw(ctx, w, h, state, p) -> figures. */
export const SIMS = {
  projectile: {
    title: "Projectile motion",
    params: [
      {
        name: "speed",
        label: "Launch speed",
        min: 5,
        max: 40,
        step: 1,
        value: 20,
        unit: "m/s",
      },
      {
        name: "angle",
        label: "Angle",
        min: 5,
        max: 85,
        step: 1,
        value: 45,
        unit: "°",
      },
      {
        name: "g",
        label: "Gravity",
        min: 1.6,
        max: 24.8,
        step: 0.1,
        value: 9.8,
        unit: "m/s²",
      },
      {
        name: "height",
        label: "Launch height",
        min: 0,
        max: 30,
        step: 1,
        value: 0,
        unit: "m",
      },
    ],
    animated: true,
    reset: (s) => {
      s.t = 0;
      s.trail = [];
    },
    step(s, p, dt) {
      const a = (p.angle * Math.PI) / 180;
      const vx = p.speed * Math.cos(a);
      const vy = p.speed * Math.sin(a);
      const T = (vy + Math.sqrt(vy * vy + 2 * p.g * p.height)) / p.g;
      s.T = T;
      s.t = Math.min(T, s.t + dt);
      s.x = vx * s.t;
      s.y = p.height + vy * s.t - 0.5 * p.g * s.t * s.t;
      s.trail.push([s.x, s.y]);
      if (s.trail.length > 2000) s.trail.shift();
      s.done = s.t >= T;
    },
    draw(ctx, w, h, s, p) {
      const a = (p.angle * Math.PI) / 180;
      const vx = p.speed * Math.cos(a);
      const vy = p.speed * Math.sin(a);
      const T = (vy + Math.sqrt(vy * vy + 2 * p.g * p.height)) / p.g;
      const range = vx * T;
      const top = p.height + (vy * vy) / (2 * p.g);
      // the scale follows the longest throw at this speed (45°), so changing the angle compares
      const best = (p.speed * p.speed) / p.g + p.height;
      const worldW = Math.max(10, range * 1.08, best * 1.08);
      const k = Math.min((w - 70) / worldW, (h - 60) / Math.max(1, top * 1.12));
      const X = (x) => 40 + x * k;
      const Y = (y) => h - 30 - y * k;
      ctx.fillStyle = css("--soft", "#F1F5F9");
      ctx.fillRect(0, Y(0), w, h - Y(0));
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 1;
      for (let m = 0; m <= worldW; m += niceStep(worldW)) {
        ctx.beginPath();
        ctx.moveTo(X(m), Y(0));
        ctx.lineTo(X(m), Y(0) + 6);
        ctx.stroke();
        label(ctx, `${m} m`, X(m), Y(0) + 20, "#64748B", 11, "center");
      }
      if (p.height) {
        ctx.fillStyle = "#94A3B8";
        ctx.fillRect(X(0) - 14, Y(p.height), 14, p.height * k);
      }
      // the whole path, faint
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = "#94A3B8";
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const t = (T * i) / 80;
        const x = X(vx * t);
        const y = Y(p.height + vy * t - 0.5 * p.g * t * t);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = css("--accent", "#4F46E5");
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const [i, [x, y]] of (s.trail || []).entries()) {
        if (i) ctx.lineTo(X(x), Y(y));
        else ctx.moveTo(X(x), Y(y));
      }
      ctx.stroke();
      const bx = X(s.x ?? 0);
      const by = Y(s.y ?? p.height);
      if (s.t > 0) {
        const vyy = vy - p.g * s.t;
        arrow(ctx, bx, by, bx + vx * 2, by, "#059669");
        arrow(ctx, bx, by, bx, by - vyy * 2, "#E11D48");
      } else {
        arrow(
          ctx,
          X(0),
          Y(p.height),
          X(0) + Math.cos(a) * 60,
          Y(p.height) - Math.sin(a) * 60,
          "#64748B",
        );
      }
      ctx.fillStyle = "#0F172A";
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, TAU);
      ctx.fill();
      return [
        ["Time", `${fmt(s.t || 0, 2)} s`],
        ["Range", `${fmt(range, 1)} m`],
        ["Highest point", `${fmt(top, 1)} m`],
        ["Flight time", `${fmt(T, 2)} s`],
      ];
    },
  },

  pendulum: {
    title: "Pendulum",
    params: [
      {
        name: "length",
        label: "Length",
        min: 0.2,
        max: 3,
        step: 0.05,
        value: 1.2,
        unit: "m",
      },
      {
        name: "g",
        label: "Gravity",
        min: 1.6,
        max: 24.8,
        step: 0.1,
        value: 9.8,
        unit: "m/s²",
      },
      {
        name: "amplitude",
        label: "Start angle",
        min: 5,
        max: 80,
        step: 1,
        value: 25,
        unit: "°",
      },
      {
        name: "damping",
        label: "Air resistance",
        min: 0,
        max: 0.5,
        step: 0.01,
        value: 0.02,
      },
    ],
    animated: true,
    reset: (s, p) => {
      s.th = (p.amplitude * Math.PI) / 180;
      s.w = 0;
      s.t = 0;
      s.hist = [];
    },
    step(s, p, dt) {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const h = dt / n;
        const acc = -(p.g / p.length) * Math.sin(s.th) - p.damping * s.w;
        s.w += acc * h;
        s.th += s.w * h;
      }
      s.t += dt;
      s.hist.push(s.th);
      if (s.hist.length > 400) s.hist.shift();
    },
    draw(ctx, w, h, s, p) {
      const cx = w * 0.32;
      const k = (h - 60) / 3.2;
      const L = p.length * k;
      ctx.fillStyle = "#94A3B8";
      ctx.fillRect(cx - 60, 18, 120, 6);
      const bx = cx + L * Math.sin(s.th);
      const by = 24 + L * Math.cos(s.th);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, 24);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = css("--accent", "#4F46E5");
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, TAU);
      ctx.fill();
      // angle over time
      const gx = w * 0.62;
      const gw = w * 0.34;
      const gy = h / 2;
      ctx.strokeStyle = "#E2E8F0";
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + gw, gy);
      ctx.stroke();
      label(ctx, "angle over time", gx, 30, "#64748B", 11);
      ctx.strokeStyle = "#E11D48";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const amp = (p.amplitude * Math.PI) / 180;
      s.hist.forEach((v, i) => {
        const x = gx + (i / 400) * gw;
        const y = gy - (v / Math.max(amp, 0.01)) * (h / 2 - 50);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      const T = TAU * Math.sqrt(p.length / p.g);
      return [
        ["Period (small swings)", `${fmt(T, 2)} s`],
        ["Angle now", `${fmt((s.th * 180) / Math.PI, 1)}°`],
        ["Time", `${fmt(s.t, 1)} s`],
      ];
    },
  },

  spring: {
    title: "Mass on a spring",
    params: [
      {
        name: "mass",
        label: "Mass",
        min: 0.1,
        max: 5,
        step: 0.1,
        value: 1,
        unit: "kg",
      },
      {
        name: "k",
        label: "Spring stiffness k",
        min: 1,
        max: 100,
        step: 1,
        value: 20,
        unit: "N/m",
      },
      {
        name: "damping",
        label: "Damping",
        min: 0,
        max: 3,
        step: 0.05,
        value: 0.2,
      },
      {
        name: "pull",
        label: "Pulled by",
        min: 0.05,
        max: 0.5,
        step: 0.01,
        value: 0.3,
        unit: "m",
      },
    ],
    animated: true,
    reset: (s, p) => {
      s.x = p.pull;
      s.v = 0;
      s.t = 0;
      s.hist = [];
    },
    step(s, p, dt) {
      for (let i = 0; i < 8; i++) {
        const h = dt / 8;
        const a = (-p.k * s.x - p.damping * s.v) / p.mass;
        s.v += a * h;
        s.x += s.v * h;
      }
      s.t += dt;
      s.hist.push(s.x);
      if (s.hist.length > 400) s.hist.shift();
    },
    draw(ctx, w, h, s, p) {
      const cx = w * 0.25;
      const rest = h * 0.45;
      const k = (h * 0.4) / 0.5;
      const y = rest + s.x * k;
      ctx.fillStyle = "#94A3B8";
      ctx.fillRect(cx - 60, 12, 120, 6);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, 18);
      const coils = 14;
      for (let i = 1; i <= coils; i++)
        ctx.lineTo(cx + (i % 2 ? 16 : -16), 18 + ((y - 40 - 18) * i) / coils);
      ctx.lineTo(cx, y - 22);
      ctx.stroke();
      const size = 26 + p.mass * 6;
      ctx.fillStyle = css("--accent", "#4F46E5");
      ctx.fillRect(cx - size / 2, y - 22, size, size);
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "#CBD5E1";
      ctx.beginPath();
      ctx.moveTo(cx - 70, rest);
      ctx.lineTo(cx + 70, rest);
      ctx.stroke();
      ctx.setLineDash([]);
      const gx = w * 0.5;
      const gw = w * 0.46;
      ctx.strokeStyle = "#E2E8F0";
      ctx.beginPath();
      ctx.moveTo(gx, rest);
      ctx.lineTo(gx + gw, rest);
      ctx.stroke();
      label(ctx, "position over time", gx, 30, "#64748B", 11);
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.hist.forEach((v, i) => {
        const x = gx + (i / 400) * gw;
        const yy = rest + v * k;
        i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      });
      ctx.stroke();
      const T = TAU * Math.sqrt(p.mass / p.k);
      return [
        ["Period", `${fmt(T, 2)} s`],
        [
          "Energy stored",
          `${fmt(0.5 * p.k * s.x * s.x + 0.5 * p.mass * s.v * s.v, 2)} J`,
        ],
        ["Speed", `${fmt(Math.abs(s.v), 2)} m/s`],
      ];
    },
  },

  waves: {
    title: "Waves and interference",
    params: [
      {
        name: "amplitude",
        label: "Amplitude A",
        min: 0.1,
        max: 1,
        step: 0.05,
        value: 0.6,
      },
      {
        name: "wavelength",
        label: "Wavelength λ",
        min: 0.5,
        max: 6,
        step: 0.1,
        value: 3,
        unit: "m",
      },
      {
        name: "frequency",
        label: "Frequency f",
        min: 0.1,
        max: 2,
        step: 0.05,
        value: 0.5,
        unit: "Hz",
      },
      {
        name: "second",
        label: "Second wave (0 off, 1 on)",
        min: 0,
        max: 1,
        step: 1,
        value: 0,
      },
      {
        name: "shift",
        label: "Second wave shift",
        min: 0,
        max: 360,
        step: 5,
        value: 180,
        unit: "°",
      },
    ],
    animated: true,
    reset: (s) => {
      s.t = 0;
    },
    step(s, _p, dt) {
      s.t += dt;
    },
    draw(ctx, w, h, s, p) {
      const mid = h / 2;
      const span = 12;
      const k = TAU / p.wavelength;
      const om = TAU * p.frequency;
      const amp = (h / 2 - 30) / 2;
      const X = (x) => 20 + (x / span) * (w - 40);
      const wave = (x, ph = 0) => p.amplitude * Math.sin(k * x - om * s.t + ph);
      const line = (f, colour, width, dash) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        for (let i = 0; i <= 400; i++) {
          const x = (span * i) / 400;
          const y = mid - f(x) * amp;
          i ? ctx.lineTo(X(x), y) : ctx.moveTo(X(x), y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      ctx.strokeStyle = "#E2E8F0";
      ctx.beginPath();
      ctx.moveTo(20, mid);
      ctx.lineTo(w - 20, mid);
      ctx.stroke();
      const ph = (p.shift * Math.PI) / 180;
      if (p.second) {
        line((x) => wave(x), "#93C5FD", 1.5, [5, 5]);
        line((x) => wave(x, ph), "#FCA5A5", 1.5, [5, 5]);
        line((x) => wave(x) + wave(x, ph), css("--accent", "#4F46E5"), 3);
      } else line((x) => wave(x), css("--accent", "#4F46E5"), 3);
      // one marked particle moves only up and down
      const px = X(2);
      const py = mid - (wave(2) + (p.second ? wave(2, ph) : 0)) * amp;
      ctx.fillStyle = "#E11D48";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, TAU);
      ctx.fill();
      return [
        ["Speed v = λ·f", `${fmt(p.wavelength * p.frequency, 2)} m/s`],
        ["Period T = 1/f", `${fmt(1 / p.frequency, 2)} s`],
        ...(p.second
          ? [
              [
                "Together",
                Math.abs(Math.cos(ph / 2)) < 0.05
                  ? "cancel out"
                  : Math.abs(Math.cos(ph / 2)) > 0.95
                    ? "add up"
                    : "partly",
              ],
            ]
          : []),
      ];
    },
  },

  circuit: {
    title: "Ohm's law: a simple circuit",
    params: [
      {
        name: "voltage",
        label: "Battery voltage U",
        min: 1,
        max: 24,
        step: 0.5,
        value: 9,
        unit: "V",
      },
      {
        name: "resistance",
        label: "Resistance R",
        min: 1,
        max: 100,
        step: 1,
        value: 30,
        unit: "Ω",
      },
    ],
    animated: true,
    reset: (s) => {
      s.t = 0;
    },
    step(s, p, dt) {
      s.t += dt * (p.voltage / p.resistance) * 4;
    },
    draw(ctx, w, h, s, p) {
      const I = p.voltage / p.resistance;
      const P = p.voltage * I;
      const x0 = w * 0.18;
      const x1 = w * 0.72;
      const y0 = h * 0.22;
      const y1 = h * 0.8;
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 3;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      // battery
      ctx.fillStyle = css("--bg", "#fff");
      ctx.fillRect(x0 - 12, (y0 + y1) / 2 - 22, 24, 44);
      ctx.fillStyle = "#334155";
      ctx.fillRect(x0 - 16, (y0 + y1) / 2 - 10, 32, 4);
      ctx.fillRect(x0 - 9, (y0 + y1) / 2 + 6, 18, 4);
      label(
        ctx,
        `${p.voltage} V`,
        x0 - 24,
        (y0 + y1) / 2 + 4,
        "#334155",
        13,
        "right",
      );
      // resistor
      const rx = (x0 + x1) / 2;
      ctx.fillStyle = css("--bg", "#fff");
      ctx.fillRect(rx - 40, y0 - 10, 80, 20);
      ctx.strokeStyle = "#B45309";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rx - 40, y0);
      for (let i = 0; i < 8; i++)
        ctx.lineTo(rx - 35 + i * 10, y0 + (i % 2 ? 9 : -9));
      ctx.lineTo(rx + 40, y0);
      ctx.stroke();
      label(ctx, `${p.resistance} Ω`, rx, y0 - 16, "#B45309", 13, "center");
      // bulb glows with power
      const glow = Math.min(1, P / 8);
      const bx = x1;
      const by = (y0 + y1) / 2;
      const grd = ctx.createRadialGradient(bx, by, 4, bx, by, 60);
      grd.addColorStop(0, `rgba(250,204,21,${0.2 + glow * 0.8})`);
      grd.addColorStop(1, "rgba(250,204,21,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(bx, by, 60, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(250,204,21,${0.3 + glow * 0.7})`;
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // electrons move around the loop (against the current's arrow)
      const per = 2 * (x1 - x0 + y1 - y0);
      ctx.fillStyle = "#0EA5E9";
      for (let i = 0; i < 18; i++) {
        let d = ((((i / 18) * per - s.t * 40) % per) + per) % per;
        let x;
        let y;
        if (d < x1 - x0) [x, y] = [x0 + d, y0];
        else if ((d -= x1 - x0) < y1 - y0) [x, y] = [x1, y0 + d];
        else if ((d -= y1 - y0) < x1 - x0) [x, y] = [x1 - d, y1];
        else [x, y] = [x0, y1 - (d - (x1 - x0))];
        // not drawn over the resistor, the bulb or the battery
        if (
          Math.hypot(x - rx, y - y0) < 46 ||
          Math.hypot(x - bx, y - by) < 22 ||
          Math.hypot(x - x0, y - (y0 + y1) / 2) < 26
        )
          continue;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, TAU);
        ctx.fill();
      }
      return [
        ["Current I = U/R", `${fmt(I, 3)} A`],
        ["Power P = U·I", `${fmt(P, 2)} W`],
      ];
    },
  },

  orbit: {
    title: "Orbits",
    params: [
      {
        name: "speed",
        label: "Start speed",
        min: 0.4,
        max: 1.6,
        step: 0.01,
        value: 1,
        unit: "× circular",
      },
      {
        name: "mass",
        label: "Star mass",
        min: 0.5,
        max: 2,
        step: 0.05,
        value: 1,
        unit: "× Sun",
      },
    ],
    animated: true,
    reset: (s, p) => {
      s.x = 1;
      s.y = 0;
      s.vx = 0;
      s.vy = p.speed * Math.sqrt(p.mass);
      s.t = 0;
      s.trail = [];
    },
    step(s, p, dt) {
      const n = 40;
      for (let i = 0; i < n; i++) {
        const h = (dt * 1.2) / n;
        const r = Math.hypot(s.x, s.y);
        const a = -p.mass / (r * r * r);
        s.vx += a * s.x * h;
        s.vy += a * s.y * h;
        s.x += s.vx * h;
        s.y += s.vy * h;
      }
      s.t += dt;
      s.trail.push([s.x, s.y]);
      if (s.trail.length > 900) s.trail.shift();
    },
    draw(ctx, w, h, s, p) {
      const cx = w / 2;
      const cy = h / 2;
      const k = Math.min(w, h) / 6;
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#FACC15";
      ctx.beginPath();
      ctx.arc(cx, cy, 10 + p.mass * 6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [i, [x, y]] of s.trail.entries()) {
        if (i) ctx.lineTo(cx + x * k, cy - y * k);
        else ctx.moveTo(cx + x * k, cy - y * k);
      }
      ctx.stroke();
      ctx.fillStyle = "#38BDF8";
      ctx.beginPath();
      ctx.arc(cx + s.x * k, cy - s.y * k, 7, 0, TAU);
      ctx.fill();
      const r = Math.hypot(s.x, s.y);
      const v = Math.hypot(s.vx, s.vy);
      const energy = 0.5 * v * v - p.mass / r;
      return [
        ["Distance", `${fmt(r, 2)} AU`],
        ["Speed", `${fmt(v * 29.8, 1)} km/s`],
        [
          "Path",
          energy >= 0
            ? "escapes"
            : Math.abs(p.speed - 1) < 0.02
              ? "circle"
              : "ellipse",
        ],
      ];
    },
  },

  growth: {
    title: "Population growth",
    params: [
      {
        name: "start",
        label: "Starting population",
        min: 2,
        max: 200,
        step: 1,
        value: 10,
      },
      {
        name: "rate",
        label: "Growth rate r",
        min: 0.05,
        max: 1,
        step: 0.01,
        value: 0.3,
        unit: "/ year",
      },
      {
        name: "capacity",
        label: "Carrying capacity K",
        min: 100,
        max: 2000,
        step: 10,
        value: 1000,
      },
      {
        name: "years",
        label: "Years shown",
        min: 10,
        max: 60,
        step: 1,
        value: 30,
      },
    ],
    draw(ctx, w, h, _s, p) {
      const X = (t) => 50 + (t / p.years) * (w - 70);
      const top = p.capacity * 1.4;
      const Y = (n) => h - 30 - (n / top) * (h - 60);
      ctx.strokeStyle = "#CBD5E1";
      ctx.beginPath();
      ctx.moveTo(50, 20);
      ctx.lineTo(50, h - 30);
      ctx.lineTo(w - 20, h - 30);
      ctx.stroke();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#94A3B8";
      ctx.beginPath();
      ctx.moveTo(50, Y(p.capacity));
      ctx.lineTo(w - 20, Y(p.capacity));
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, "K", 36, Y(p.capacity) + 4, "#64748B", 12);
      const curve = (f, colour) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 3;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 300; i++) {
          const t = (p.years * i) / 300;
          const n = f(t);
          if (n > top * 1.05) break;
          started ? ctx.lineTo(X(t), Y(n)) : ctx.moveTo(X(t), Y(n));
          started = true;
        }
        ctx.stroke();
      };
      const expo = (t) => p.start * Math.exp(p.rate * t);
      const logi = (t) =>
        p.capacity /
        (1 + ((p.capacity - p.start) / p.start) * Math.exp(-p.rate * t));
      curve(expo, "#E11D48");
      curve(logi, css("--accent", "#4F46E5"));
      label(ctx, "unlimited (exponential)", w - 24, 34, "#E11D48", 12, "right");
      label(
        ctx,
        "limited (logistic)",
        w - 24,
        52,
        css("--accent", "#4F46E5"),
        12,
        "right",
      );
      for (let t = 0; t <= p.years; t += niceStep(p.years))
        label(ctx, String(t), X(t), h - 12, "#64748B", 11, "center");
      return [
        ["Doubling time", `${fmt(Math.LN2 / p.rate, 1)} years`],
        [`After ${p.years} years, unlimited`, fmt(expo(p.years), 0)],
        [`After ${p.years} years, limited`, fmt(logi(p.years), 0)],
      ];
    },
  },

  market: {
    title: "Supply and demand",
    params: [
      {
        name: "demand",
        label: "Demand (shift)",
        min: -30,
        max: 30,
        step: 1,
        value: 0,
      },
      {
        name: "supply",
        label: "Supply (shift)",
        min: -30,
        max: 30,
        step: 1,
        value: 0,
      },
      {
        name: "elasticity",
        label: "Demand steepness",
        min: 0.4,
        max: 2.5,
        step: 0.05,
        value: 1,
      },
      {
        name: "tax",
        label: "Tax per item",
        min: 0,
        max: 30,
        step: 1,
        value: 0,
      },
    ],
    draw(ctx, w, h, _s, p) {
      // demand: P = 100 + d - e*Q ; supply: P = 10 - s + Q*0.8 + tax
      const dem = (q) => 100 + p.demand - p.elasticity * q;
      const sup = (q) => 10 - p.supply + 0.8 * q + p.tax;
      const supNoTax = (q) => 10 - p.supply + 0.8 * q;
      const Q = (90 + p.demand + p.supply - p.tax) / (p.elasticity + 0.8);
      const P = dem(Q);
      const X = (q) => 60 + (q / 120) * (w - 90);
      const Y = (pr) => h - 36 - (pr / 140) * (h - 60);
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(60, 14);
      ctx.lineTo(60, h - 36);
      ctx.lineTo(w - 20, h - 36);
      ctx.stroke();
      label(ctx, "price", 14, 24, "#64748B", 11);
      label(ctx, "quantity", w - 22, h - 14, "#64748B", 11, "right");
      const line = (f, colour, dash) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 3;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        let started = false;
        for (let q = 0; q <= 120; q += 1) {
          const pr = f(q);
          if (pr < 0 || pr > 140) continue;
          started ? ctx.lineTo(X(q), Y(pr)) : ctx.moveTo(X(q), Y(pr));
          started = true;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      if (p.tax) line(supNoTax, "#FCA5A5", [6, 6]);
      line(dem, css("--accent", "#4F46E5"));
      line(sup, "#E11D48");
      label(
        ctx,
        "demand",
        X(100),
        Y(dem(100)) - 8,
        css("--accent", "#4F46E5"),
        12,
      );
      label(
        ctx,
        "supply",
        X(Math.min(110, (130 - 10 + p.supply - p.tax) / 0.8)),
        Y(Math.min(130, sup(110))) - 8,
        "#E11D48",
        12,
        "right",
      );
      if (Q > 0 && P > 0) {
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = "#64748B";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(60, Y(P));
        ctx.lineTo(X(Q), Y(P));
        ctx.lineTo(X(Q), h - 36);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#0F172A";
        ctx.beginPath();
        ctx.arc(X(Q), Y(P), 6, 0, TAU);
        ctx.fill();
      }
      return [
        ["Market price", fmt(P, 1)],
        ["Quantity sold", fmt(Q, 1)],
        ...(p.tax ? [["Tax collected", fmt(p.tax * Q, 0)]] : []),
      ];
    },
  },

  dice: {
    title: "Probability with dice",
    params: [
      {
        name: "dice",
        label: "Dice per roll",
        min: 1,
        max: 4,
        step: 1,
        value: 2,
      },
      {
        name: "speed",
        label: "Rolls per second",
        min: 1,
        max: 200,
        step: 1,
        value: 20,
      },
    ],
    animated: true,
    reset: (s, p) => {
      s.counts = new Array(6 * p.dice + 1).fill(0);
      s.n = 0;
      s.acc = 0;
      s.last = [];
    },
    step(s, p, dt) {
      if (s.counts.length !== 6 * p.dice + 1) {
        s.counts = new Array(6 * p.dice + 1).fill(0);
        s.n = 0;
      }
      s.acc += dt * p.speed;
      while (s.acc >= 1) {
        s.acc -= 1;
        s.last = Array.from(
          { length: p.dice },
          () => 1 + Math.floor(Math.random() * 6),
        );
        s.counts[s.last.reduce((a, b) => a + b, 0)]++;
        s.n++;
      }
    },
    draw(ctx, w, h, s, p) {
      const lo = p.dice;
      const hi = 6 * p.dice;
      // exact probabilities by convolution
      let dist = [1];
      for (let d = 0; d < p.dice; d++) {
        const nx = new Array(dist.length + 6).fill(0);
        dist.forEach((v, i) => {
          for (let f = 1; f <= 6; f++) nx[i + f] += v / 6;
        });
        dist = nx;
      }
      const bars = hi - lo + 1;
      const bw = (w - 80) / bars;
      const max = Math.max(...dist.slice(lo, hi + 1)) * 1.3;
      const Y = (v) => h - 40 - (v / max) * (h - 90);
      for (let v = lo; v <= hi; v++) {
        const x = 50 + (v - lo) * bw;
        const share = s.n ? s.counts[v] / s.n : 0;
        ctx.fillStyle = css("--accent", "#4F46E5");
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x + 2, Y(share), bw - 4, h - 40 - Y(share));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#E11D48";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + 2, Y(dist[v]));
        ctx.lineTo(x + bw - 2, Y(dist[v]));
        ctx.stroke();
        if (bars <= 13 || v % 2 === 0)
          label(ctx, String(v), x + bw / 2, h - 22, "#64748B", 11, "center");
      }
      // the last roll as dice faces
      s.last.forEach((f, i) => {
        const x = 50 + i * 40;
        ctx.fillStyle = css("--bg", "#fff");
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, 12, 32, 32, 6);
        ctx.fill();
        ctx.stroke();
        const pips = {
          1: [[1, 1]],
          2: [
            [0, 0],
            [2, 2],
          ],
          3: [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
          4: [
            [0, 0],
            [2, 0],
            [0, 2],
            [2, 2],
          ],
          5: [
            [0, 0],
            [2, 0],
            [1, 1],
            [0, 2],
            [2, 2],
          ],
          6: [
            [0, 0],
            [2, 0],
            [0, 1],
            [2, 1],
            [0, 2],
            [2, 2],
          ],
        }[f];
        ctx.fillStyle = "#0F172A";
        for (const [a, b] of pips) {
          ctx.beginPath();
          ctx.arc(x + 8 + a * 8, 20 + b * 8, 2.6, 0, TAU);
          ctx.fill();
        }
      });
      label(
        ctx,
        "bars: what happened · red lines: what probability predicts",
        w - 20,
        30,
        "#64748B",
        11,
        "right",
      );
      return [
        ["Rolls", s.n.toLocaleString("en")],
        ["Most likely sum", String(Math.round((lo + hi) / 2))],
      ];
    },
  },

  fractions: {
    title: "Fractions",
    params: [
      {
        name: "top",
        label: "Numerator (top)",
        min: 0,
        max: 12,
        step: 1,
        value: 3,
      },
      {
        name: "bottom",
        label: "Denominator (bottom)",
        min: 1,
        max: 12,
        step: 1,
        value: 4,
      },
    ],
    draw(ctx, w, h, _s, p) {
      const n = p.bottom;
      const k = p.top;
      const r = Math.min(h / 2 - 30, w / 5);
      const cx = w * 0.27;
      const cy = h / 2;
      const whole = Math.max(1, Math.ceil(k / n));
      const pies = Math.min(3, whole);
      const pr = pies > 1 ? r * 0.62 : r;
      for (let pi = 0; pi < pies; pi++) {
        const x = cx + (pi - (pies - 1) / 2) * (pr * 2.15);
        for (let i = 0; i < n; i++) {
          const a0 = -Math.PI / 2 + (i / n) * TAU;
          const a1 = -Math.PI / 2 + ((i + 1) / n) * TAU;
          ctx.fillStyle =
            pi * n + i < k ? css("--accent", "#4F46E5") : "#E2E8F0";
          ctx.beginPath();
          ctx.moveTo(x, cy);
          ctx.arc(x, cy, pr, a0, a1);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      // bar
      const bx = w * 0.56;
      const bw = w * 0.38;
      const bh = 44;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < k ? css("--accent", "#4F46E5") : "#E2E8F0";
        ctx.fillRect(bx + (i * bw) / n + 1.5, cy - bh / 2, bw / n - 3, bh);
      }
      label(
        ctx,
        `${k}/${n}`,
        bx + bw / 2,
        cy - bh / 2 - 18,
        "#0F172A",
        28,
        "center",
      );
      const g = gcd(k, n);
      const simpler = g > 1 ? `${k / g}/${n / g}` : "already simplest";
      return [
        ["As a decimal", fmt(k / n, 3)],
        ["As a percent", `${fmt((k / n) * 100, 1)}%`],
        ["Simplest form", simpler],
      ];
    },
  },
};

function gcd(a, b) {
  return b ? gcd(b, a % b) : Math.abs(a) || 1;
}
function niceStep(span) {
  const raw = span / 6;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

/** Mount a simulation. spec: { sim, params: {name: value}, caption, height }. */
export function mountSim(el, spec = {}) {
  const def = SIMS[spec.sim];
  if (!def) {
    el.innerHTML = `<div class="muted">Unknown simulation "${String(spec.sim)}". Available: ${Object.keys(SIMS).join(", ")}.</div>`;
    return null;
  }
  const p = {};
  for (const q of def.params) p[q.name] = spec.params?.[q.name] ?? q.value;
  const s = {};
  const H = spec.height || 320;
  el.classList.add("sim");
  el.innerHTML = `<div class="sim-head"><b>${spec.title || def.title}</b>${def.animated ? `<span class="sim-ctl"><button type="button" class="btn sm" data-a="play">▶ Play</button><button type="button" class="btn ghost sm" data-a="reset">↺ Reset</button></span>` : ""}</div>
    <canvas height="${H}"></canvas><div class="sim-figs"></div>
    <div class="sim-params">${def.params
      .map(
        (q) =>
          `<label><span>${q.label} <b data-v="${q.name}">${fmt(p[q.name], 2)}${q.unit ? ` ${q.unit}` : ""}</b></span><input type="range" min="${q.min}" max="${q.max}" step="${q.step}" value="${p[q.name]}" data-p="${q.name}"></label>`,
      )
      .join("")}</div>`;
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let running = false;
  let lastT = 0;
  let raf = 0;
  const reset = () => {
    def.reset?.(s, p);
    if (def.animated && def.step) def.step(s, p, 0);
    paint();
  };
  function paint() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.height = `${H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    const figs = def.draw(ctx, w, H, s, p) || [];
    el.querySelector(".sim-figs").innerHTML = figs
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
      .join("");
  }
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    def.step(s, p, dt);
    paint();
    if (s.done) {
      running = false;
      setPlay();
      return;
    }
    if (running) raf = requestAnimationFrame(loop);
  }
  const playBtn = el.querySelector('[data-a="play"]');
  const setPlay = () => {
    if (playBtn) playBtn.textContent = running ? "❚❚ Pause" : "▶ Play";
  };
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "play") {
      if (s.done) reset();
      running = !running;
      setPlay();
      if (running) {
        lastT = performance.now();
        raf = requestAnimationFrame(loop);
      } else cancelAnimationFrame(raf);
    }
    if (a === "reset") {
      running = false;
      cancelAnimationFrame(raf);
      setPlay();
      reset();
    }
  });
  el.querySelector(".sim-params").addEventListener("input", (e) => {
    const n = e.target.dataset.p;
    if (!n) return;
    p[n] = Number(e.target.value);
    const q = def.params.find((x) => x.name === n);
    el.querySelector(`[data-v="${n}"]`).textContent =
      `${fmt(p[n], 2)}${q.unit ? ` ${q.unit}` : ""}`;
    if (!running) reset();
    else if (!["dice", "waves", "circuit"].includes(spec.sim)) reset();
  });
  new ResizeObserver(() => paint()).observe(canvas);
  reset();
  return { reset };
}
