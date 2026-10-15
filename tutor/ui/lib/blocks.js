/*
 * THE LESSON RENDERER: turns a lesson's blocks into a page to learn from. Text with formulas
 * ($...$, $$...$$, chemistry with \ce{}), callouts, figures, graphs, simulations, worked examples
 * revealed step by step, quizzes of nine kinds, exercises solved step by step with hints, flashcards,
 * timelines, tables, key terms, comparisons and a reflection box. Every answer is reported through
 * `on.answer(id, correct)` so progress can count it; nothing here talks to storage itself.
 */
import { checkAnswer } from "./expr.js";
import { mountGraph } from "./graph.js";
import { mountSim } from "./sims.js";

export function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/* -------------------------------------------------------------------------- text and maths */

export function tex(src, display = false) {
  try {
    return window.katex.renderToString(String(src), {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    });
  } catch {
    return `<code>${esc(src)}</code>`;
  }
}

/** Inline markup: **bold**, *italic*, `code`, $maths$, ==highlight==. Escapes everything else. */
export function inline(text) {
  const parts = String(text ?? "").split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return parts
    .map((p) => {
      if (/^\$\$[\s\S]+\$\$$/.test(p)) return tex(p.slice(2, -2), true);
      if (/^\$[^$]+\$$/.test(p)) return tex(p.slice(1, -1));
      return esc(p)
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<i>$2</i>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/==(.+?)==/g, "<mark>$1</mark>");
    })
    .join("");
}

/** Paragraphs and lists from plain text. */
export function rich(text) {
  const lines = String(text ?? "").split("\n");
  let html = "";
  let list = null;
  let para = [];
  const flush = () => {
    if (para.length) html += `<p>${inline(para.join(" "))}</p>`;
    para = [];
  };
  const close = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•*]\s+(.*)/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)/.exec(line);
    if (bullet || num) {
      flush();
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) {
        close();
        html += `<${kind}>`;
        list = kind;
      }
      html += `<li>${inline((bullet || num)[1])}</li>`;
    } else if (!line.trim()) {
      flush();
      close();
    } else {
      close();
      // a display formula on its own line keeps its own block
      if (/^\$\$[\s\S]+\$\$$/.test(line.trim())) {
        flush();
        html += `<div class="disp">${tex(line.trim().slice(2, -2), true)}</div>`;
      } else para.push(line);
    }
  }
  flush();
  close();
  return html;
}

function cleanSvg(svg) {
  return String(svg || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi, "");
}

/* -------------------------------------------------------------------------- celebration */

export function celebrate(el, big = false) {
  const host = el.closest(".lesson") || document.body;
  const box = document.createElement("div");
  box.className = "confetti";
  const colours = [
    "#F59E0B",
    "#10B981",
    "#6366F1",
    "#EC4899",
    "#06B6D4",
    "#EF4444",
  ];
  const n = big ? 90 : 26;
  const r = el.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    s.style.left = `${r.left - hr.left + r.width / 2}px`;
    s.style.top = `${r.top - hr.top + (big ? 0 : r.height / 2)}px`;
    s.style.background = colours[i % colours.length];
    const a = Math.random() * Math.PI * 2;
    const d = (big ? 220 : 90) + Math.random() * (big ? 260 : 80);
    s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    s.style.setProperty("--dy", `${Math.sin(a) * d - (big ? 120 : 40)}px`);
    s.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    s.style.animationDelay = `${Math.random() * 0.12}s`;
    box.appendChild(s);
  }
  host.appendChild(box);
  setTimeout(() => box.remove(), 1600);
}

const PRAISE = {
  kids: ["Super!", "Bravo!", "You got it!", "Great job!", "Brilliant!", "Yes!"],
  other: ["Correct.", "Right.", "Exactly.", "Well done.", "That's it."],
};
const praise = (kids) => {
  const list = kids ? PRAISE.kids : PRAISE.other;
  return list[Math.floor(Math.random() * list.length)];
};

/* -------------------------------------------------------------------------- questions */

function shuffle(a, seed = 7) {
  const out = [...a];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The input for one question kind; returns { html, read(), lock(correct), reveal() }. */
function questionInput(q, root, qid) {
  const kind =
    q.kind ||
    (Array.isArray(q.options)
      ? Array.isArray(q.answer)
        ? "multi"
        : "choice"
      : typeof q.answer === "boolean"
        ? "truefalse"
        : typeof q.answer === "number"
          ? "number"
          : "text");
  if (kind === "choice" || kind === "multi" || kind === "truefalse") {
    const options = kind === "truefalse" ? ["True", "False"] : q.options || [];
    const type = kind === "multi" ? "checkbox" : "radio";
    return {
      kind,
      html: `<div class="opts ${options.some((o) => String(o).length > 40) ? "wide" : ""}">${options
        .map(
          (o, i) =>
            `<label class="opt"><input type="${type}" name="${qid}" value="${i}"><span class="key">${kind === "multi" ? "" : String.fromCharCode(65 + i)}</span><span>${inline(o)}</span></label>`,
        )
        .join(
          "",
        )}</div>${kind === "multi" ? `<div class="muted small">Choose all that are right.</div>` : ""}`,
      read() {
        const picked = [
          ...root.querySelectorAll(`input[name="${qid}"]:checked`),
        ].map((i) => Number(i.value));
        if (kind === "truefalse") return picked.length ? picked[0] === 0 : null;
        if (kind === "choice") return picked.length ? picked[0] : null;
        return picked;
      },
      check(v) {
        if (kind === "truefalse") return v === q.answer;
        return checkAnswer(v, q.answer, { kind: "choice" });
      },
      reveal() {
        const want =
          kind === "truefalse" ? [q.answer ? 0 : 1] : [].concat(q.answer);
        root.querySelectorAll(`input[name="${qid}"]`).forEach((inp) => {
          inp
            .closest(".opt")
            .classList.toggle("right", want.includes(Number(inp.value)));
        });
      },
      mark(correct) {
        root.querySelectorAll(`input[name="${qid}"]:checked`).forEach((inp) => {
          inp.closest(".opt").classList.add(correct ? "right" : "wrong");
        });
      },
      clear() {
        for (const o of root.querySelectorAll(".opt"))
          o.classList.remove("wrong");
      },
    };
  }
  if (kind === "order") {
    const items = q.items || [];
    let order = shuffle(
      items.map((_, i) => i),
      items.length * 13 + 5,
    );
    if (order.every((v, i) => v === i) && items.length > 1)
      order = [...order].reverse();
    const draw = () => {
      root.querySelector(".order").innerHTML = order
        .map(
          (k, pos) =>
            `<div class="ord" data-pos="${pos}"><span class="num">${pos + 1}</span><span class="t">${inline(items[k])}</span><span class="mv"><button type="button" data-up="${pos}" ${pos === 0 ? "disabled" : ""} aria-label="Up">↑</button><button type="button" data-down="${pos}" ${pos === order.length - 1 ? "disabled" : ""} aria-label="Down">↓</button></span></div>`,
        )
        .join("");
    };
    queueMicrotask(() => {
      draw();
      root.querySelector(".order").addEventListener("click", (e) => {
        const up = e.target.dataset.up;
        const down = e.target.dataset.down;
        if (up !== undefined) {
          const i = Number(up);
          [order[i - 1], order[i]] = [order[i], order[i - 1]];
        } else if (down !== undefined) {
          const i = Number(down);
          [order[i + 1], order[i]] = [order[i], order[i + 1]];
        } else return;
        draw();
      });
    });
    return {
      kind,
      html: `<div class="order"></div>`,
      read: () => order,
      check: (v) => v.every((k, i) => k === i),
      reveal() {
        order = items.map((_, i) => i);
        draw();
      },
      mark() {},
      clear() {},
    };
  }
  if (kind === "match") {
    const pairs = q.pairs || [];
    const rights = shuffle(
      pairs.map((p) => p[1]),
      pairs.length * 7 + 3,
    );
    return {
      kind,
      html: `<div class="match">${pairs
        .map(
          (p, i) =>
            `<div class="mrow"><span>${inline(p[0])}</span><select class="in" data-m="${i}"><option value="">Choose…</option>${rights.map((r) => `<option>${esc(r)}</option>`).join("")}</select></div>`,
        )
        .join("")}</div>`,
      read: () => [...root.querySelectorAll("[data-m]")].map((s) => s.value),
      check: (v) => v.every((x, i) => x === pairs[i][1]),
      reveal() {
        root.querySelectorAll("[data-m]").forEach((s, i) => {
          s.value = pairs[i][1];
        });
      },
      mark(correct) {
        root.querySelectorAll("[data-m]").forEach((s, i) => {
          s.classList.toggle("bad-in", !correct && s.value !== pairs[i][1]);
        });
      },
      clear() {},
    };
  }
  if (kind === "blank") {
    // "The capital of France is [[Paris]]." Several gaps allowed; [[a|b]] accepts either.
    const gaps = [];
    const html = esc(q.text || q.prompt || "").replace(
      /\[\[(.+?)\]\]/g,
      (_, a) => {
        gaps.push(a.split("|").map((x) => x.replace(/&amp;/g, "&")));
        return `<input class="in gap" data-g="${gaps.length - 1}" size="${Math.max(4, a.split("|")[0].length + 1)}" autocomplete="off">`;
      },
    );
    return {
      kind,
      html: `<p class="blank">${html}</p>`,
      read: () => [...root.querySelectorAll("[data-g]")].map((i) => i.value),
      check: (v) =>
        v.every((x, i) =>
          checkAnswer(x, gaps[i], {
            kind: /^-?[\d.,]+$/.test(gaps[i][0]) ? "number" : "text",
          }),
        ),
      reveal() {
        root.querySelectorAll("[data-g]").forEach((i, k) => {
          i.value = gaps[k][0];
        });
      },
      mark(correct) {
        root.querySelectorAll("[data-g]").forEach((i, k) => {
          const ok = checkAnswer(i.value, gaps[k], {
            kind: /^-?[\d.,]+$/.test(gaps[k][0]) ? "number" : "text",
          });
          i.classList.toggle("bad-in", !correct && !ok);
          i.classList.toggle("ok-in", ok);
        });
      },
      clear() {},
    };
  }
  // number, expr, text: one input
  const placeholder =
    kind === "number"
      ? "Your answer (a number)"
      : kind === "expr"
        ? "Your answer, e.g. 2x+1"
        : "Your answer";
  return {
    kind,
    html: `<div class="row"><input class="in ans" data-a="1" placeholder="${placeholder}" autocomplete="off" spellcheck="false">${q.unit ? `<span class="unit">${inline(q.unit)}</span>` : ""}</div>`,
    read: () => root.querySelector("[data-a]").value,
    check: (v) =>
      checkAnswer(v, q.answer, {
        kind: kind === "expr" ? "expr" : kind === "number" ? "number" : "text",
        tolerance: q.tolerance ?? 0,
        vars: q.vars || ["x"],
        form: q.form || null,
      }),
    // right value, wrong shape: "factor it" answered with the expanded form
    near: (v) =>
      kind === "expr" &&
      q.form &&
      checkAnswer(v, q.answer, { kind: "expr", vars: q.vars || ["x"] }),
    reveal() {
      root.querySelector("[data-a]").value = String([].concat(q.answer)[0]);
    },
    mark(correct) {
      root.querySelector("[data-a]").classList.toggle("bad-in", !correct);
      root.querySelector("[data-a]").classList.toggle("ok-in", correct);
    },
    clear() {},
  };
}

/**
 * One question with Check, a hint after the first miss and the answer after the second.
 * Calls done(correctFirstTime) once, when it is solved or revealed.
 */
function mountQuestion(el, q, { id, kids, on, label: lab }) {
  const qid = `q${Math.random().toString(36).slice(2, 8)}`;
  el.className = "question";
  el.innerHTML = `${lab ? `<div class="qnum">${esc(lab)}</div>` : ""}<div class="prompt">${q.kind === "blank" && !q.prompt ? "" : rich(q.prompt || "")}</div><div class="qin"></div>
    <div class="qact"><button type="button" class="btn" data-check>Check</button><button type="button" class="btn ghost" data-hint hidden>Hint</button><button type="button" class="btn ghost" data-show hidden>Show the answer</button><span class="verdict"></span></div>
    <div class="explain" hidden></div>`;
  const input = questionInput(q, el.querySelector(".qin"), qid);
  el.querySelector(".qin").innerHTML = input.html;
  let tries = 0;
  let finished = false;
  const verdict = el.querySelector(".verdict");
  const explain = el.querySelector(".explain");
  const finish = (correct, revealed) => {
    finished = true;
    el.classList.add(correct ? "solved" : "revealed");
    el.querySelector("[data-check]").hidden = true;
    el.querySelector("[data-hint]").hidden = true;
    el.querySelector("[data-show]").hidden = true;
    if (q.explanation) {
      explain.hidden = false;
      explain.innerHTML = `<b>${revealed ? "The answer" : "Why"}:</b> ${rich(q.explanation)}`;
    }
    el.querySelectorAll("input,select,.mv button").forEach((i) => {
      i.disabled = true;
    });
  };
  el.querySelector("[data-check]").addEventListener("click", () => {
    if (finished) return;
    const v = input.read();
    if (v === null || v === "" || (Array.isArray(v) && !v.length)) {
      verdict.textContent = "Answer first.";
      verdict.className = "verdict muted";
      return;
    }
    input.clear();
    const ok = input.check(v);
    tries++;
    input.mark(ok);
    on.answer?.(id, ok);
    if (ok) {
      verdict.textContent = praise(kids);
      verdict.className = "verdict ok";
      if (kids || tries === 1) celebrate(el.querySelector("[data-check]"));
      finish(true, false);
    } else {
      verdict.textContent = input.near?.(v)
        ? `Equal, but write it ${q.form === "factored" ? "as a product of brackets" : q.form === "expanded" ? "without brackets" : "in the form asked"}.`
        : tries === 1
          ? "Not quite. Try again."
          : "Still not it.";
      verdict.className = "verdict bad";
      el.classList.remove("shake");
      void el.offsetWidth;
      el.classList.add("shake");
      if (q.hint) el.querySelector("[data-hint]").hidden = false;
      if (tries >= 2) el.querySelector("[data-show]").hidden = false;
    }
  });
  el.querySelector("[data-hint]").addEventListener("click", (e) => {
    e.target.hidden = true;
    const h = document.createElement("div");
    h.className = "hint";
    h.innerHTML = `💡 ${rich(q.hint)}`;
    el.querySelector(".qact").before(h);
  });
  el.querySelector("[data-show]").addEventListener("click", () => {
    input.reveal();
    verdict.textContent = "";
    finish(false, true);
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input.in"))
      el.querySelector("[data-check]").click();
  });
}

/* -------------------------------------------------------------------------- blocks */

const CALLOUTS = {
  tip: ["💡", "Tip"],
  note: ["📝", "Note"],
  warning: ["⚠️", "Careful"],
  example: ["🔎", "Example"],
  definition: ["📘", "Definition"],
  remember: ["⭐", "Remember"],
  fact: ["🌍", "Did you know?"],
  rule: ["📐", "Rule"],
};

/**
 * Render a lesson's blocks into `root`.
 * ctx: { kids, on: { answer(id, ok), cards(cards), reflect(i, text), ask(text) }, answered: {id: state} }
 */
export function renderBlocks(root, blocks, ctx = {}) {
  const { kids = false, on = {} } = ctx;
  root.innerHTML = "";
  let qn = 0;
  blocks.forEach((b, bi) => {
    const el = document.createElement("section");
    el.className = `blk blk-${b.type}`;
    root.appendChild(el);
    switch (b.type) {
      case "heading":
        el.innerHTML = `<h2>${inline(b.text)}</h2>`;
        break;
      case "text":
        el.innerHTML = rich(b.text);
        if (kids && "speechSynthesis" in window) {
          const sp = document.createElement("button");
          sp.type = "button";
          sp.className = "speak";
          sp.title = "Read aloud";
          sp.textContent = "🔊";
          sp.addEventListener("click", () => {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(
              el.textContent.replace("🔊", ""),
            );
            if (ctx.lang) u.lang = ctx.lang;
            u.rate = 0.92;
            speechSynthesis.speak(u);
          });
          el.prepend(sp);
        }
        break;
      case "math":
        el.innerHTML = `<div class="disp">${tex(b.tex || b.text || "", true)}</div>${b.caption ? `<div class="cap">${inline(b.caption)}</div>` : ""}`;
        break;
      case "callout": {
        const [icon, name] = CALLOUTS[b.kind] || CALLOUTS.note;
        el.classList.add(`co-${CALLOUTS[b.kind] ? b.kind : "note"}`);
        el.innerHTML = `<div class="co-h"><span class="co-i">${icon}</span>${esc(b.title || name)}</div>${rich(b.text)}`;
        break;
      }
      case "figure":
        el.innerHTML = `<figure>${b.svg ? `<div class="svgfig">${cleanSvg(b.svg)}</div>` : b.src ? `<img alt="${esc(b.alt || b.caption || "")}" src="${esc(/^https?:/.test(b.src) ? b.src : deepbot.files.url(b.src))}">` : ""}${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ""}</figure>`;
        break;
      case "graph": {
        const box = document.createElement("div");
        el.appendChild(box);
        mountGraph(box, b);
        if (b.caption)
          el.insertAdjacentHTML(
            "beforeend",
            `<div class="cap">${inline(b.caption)}</div>`,
          );
        break;
      }
      case "sim": {
        const box = document.createElement("div");
        el.appendChild(box);
        mountSim(box, b);
        if (b.caption)
          el.insertAdjacentHTML(
            "beforeend",
            `<div class="cap">${inline(b.caption)}</div>`,
          );
        break;
      }
      case "steps": {
        const steps = b.steps || [];
        el.innerHTML = `<div class="ws-h">${esc(b.title || "Worked example")}</div>${b.problem ? `<div class="ws-p">${rich(b.problem)}</div>` : ""}<ol class="ws"></ol><button type="button" class="btn ghost sm" data-next>Show step 1 of ${steps.length}</button>`;
        let shown = 0;
        const ol = el.querySelector(".ws");
        const btn = el.querySelector("[data-next]");
        const next = () => {
          const s = steps[shown];
          const li = document.createElement("li");
          li.className = "pop";
          li.innerHTML = `${rich(s.text || "")}${s.math ? `<div class="disp">${tex(s.math, true)}</div>` : ""}`;
          ol.appendChild(li);
          shown++;
          if (shown >= steps.length) {
            btn.remove();
            if (b.answer)
              el.insertAdjacentHTML(
                "beforeend",
                `<div class="ws-a">${rich(b.answer)}</div>`,
              );
          } else btn.textContent = `Show step ${shown + 1} of ${steps.length}`;
        };
        btn.addEventListener("click", next);
        if (b.open) while (shown < steps.length) next();
        break;
      }
      case "quiz": {
        if (b.title)
          el.insertAdjacentHTML(
            "beforeend",
            `<div class="ws-h">${esc(b.title)}</div>`,
          );
        (b.questions || []).forEach((q, i) => {
          qn++;
          const box = document.createElement("div");
          el.appendChild(box);
          mountQuestion(box, q, {
            id: `b${bi}q${i}`,
            kids,
            on,
            label: `Question ${qn}`,
          });
        });
        break;
      }
      case "exercise":
        mountExercise(el, b, { id: `b${bi}`, kids, on });
        break;
      case "flashcards":
        mountCards(el, b, { on });
        break;
      case "timeline":
        el.innerHTML = `${b.title ? `<div class="ws-h">${esc(b.title)}</div>` : ""}<ol class="tl">${(
          b.events || []
        )
          .map(
            (e) =>
              `<li><div class="tl-d">${esc(e.date)}</div><div class="tl-b"><b>${inline(e.title)}</b>${e.text ? rich(e.text) : ""}</div></li>`,
          )
          .join("")}</ol>`;
        break;
      case "table":
        el.innerHTML = `<div class="tbl"><table>${b.head ? `<thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${(
          b.rows || []
        )
          .map(
            (r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
          )
          .join(
            "",
          )}</tbody></table></div>${b.caption ? `<div class="cap">${inline(b.caption)}</div>` : ""}`;
        break;
      case "keyterms":
        el.innerHTML = `<div class="ws-h">${esc(b.title || "Key terms")}</div><dl class="kt">${(
          b.terms || []
        )
          .map(
            (t) =>
              `<div><dt>${inline(t.term)}</dt><dd>${inline(t.meaning)}</dd></div>`,
          )
          .join("")}</dl>`;
        break;
      case "compare":
        el.innerHTML = `${b.title ? `<div class="ws-h">${esc(b.title)}</div>` : ""}<div class="cmp" style="grid-template-columns:repeat(${Math.min(3, (b.columns || []).length) || 1},1fr)">${(
          b.columns || []
        )
          .map(
            (c) =>
              `<div class="cmp-c"><b>${inline(c.title)}</b><ul>${(c.points || []).map((p) => `<li>${inline(p)}</li>`).join("")}</ul></div>`,
          )
          .join("")}</div>`;
        break;
      case "reflect": {
        el.innerHTML = `<div class="ws-h">${esc(b.title || "In your own words")}</div>${rich(b.prompt)}<textarea class="in" rows="4" placeholder="Write here…"></textarea><div class="row"><button type="button" class="btn ghost sm" data-ask>Ask the tutor what they think</button><span class="muted small" data-saved></span></div>`;
        const ta = el.querySelector("textarea");
        ta.value = ctx.reflections?.[bi] || "";
        let timer;
        ta.addEventListener("input", () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            on.reflect?.(bi, ta.value);
            el.querySelector("[data-saved]").textContent = "Saved";
          }, 600);
        });
        el.querySelector("[data-ask]").addEventListener("click", () => {
          if (!ta.value.trim()) return ta.focus();
          on.ask?.(
            `Please give me feedback on my answer.\n\nThe question: ${b.prompt}\n\nMy answer: ${ta.value}`,
          );
        });
        break;
      }
      default:
        el.innerHTML = rich(b.text || "");
    }
  });
  return { questions: qn };
}

/* -------------------------------------------------------------------------- exercises */

/** A problem solved one step at a time: each step checked, with a hint and a way to see it. */
function mountExercise(el, b, { id, kids, on }) {
  const steps = b.steps?.length
    ? b.steps
    : [
        {
          prompt: "Your answer",
          answer: b.answer,
          kind: b.kind,
          tolerance: b.tolerance,
          unit: b.unit,
          hint: b.hint,
          explain: b.explanation,
        },
      ];
  el.innerHTML = `<div class="ex-h"><span class="ex-tag">${esc(b.title || "Exercise")}</span>${b.difficulty ? `<span class="diff">${"●".repeat(Math.min(3, b.difficulty))}${"○".repeat(Math.max(0, 3 - b.difficulty))}</span>` : ""}</div>
    <div class="ex-p">${rich(b.problem || "")}</div><div class="ex-steps"></div>`;
  const box = el.querySelector(".ex-steps");
  let firstTry = true;
  let at = 0;
  const showStep = (i) => {
    const s = steps[i];
    const row = document.createElement("div");
    row.className = "ex-step pop";
    box.appendChild(row);
    const q = {
      ...s,
      prompt: `${steps.length > 1 ? `**Step ${i + 1}.** ` : ""}${s.prompt || ""}`,
      explanation: s.explain || s.explanation,
    };
    mountQuestion(row, q, {
      id: `${id}s${i}`,
      kids,
      on: {
        answer: (_sid, ok) => {
          if (!ok) firstTry = false;
          if (ok) advance();
        },
      },
    });
    row.querySelector("[data-show]").addEventListener("click", () => {
      firstTry = false;
      advance();
    });
  };
  const advance = () => {
    at++;
    if (at < steps.length) showStep(at);
    else {
      on.answer?.(id, firstTry);
      el.classList.add(firstTry ? "ex-done" : "ex-done-help");
      el.insertAdjacentHTML(
        "beforeend",
        `<div class="ex-end">${firstTry ? "✓ Solved without help." : "✓ Done. Try a similar one later to make it stick."}${b.solution ? `<details><summary>Full solution</summary>${rich(b.solution)}</details>` : ""}</div>`,
      );
    }
  };
  showStep(0);
}

/* -------------------------------------------------------------------------- flashcards */

function mountCards(el, b, { on }) {
  const cards = b.cards || [];
  let i = 0;
  el.innerHTML = `<div class="ws-h">${esc(b.title || "Flashcards")}</div><div class="fc-wrap"><button type="button" class="fc-nav" data-prev aria-label="Previous">‹</button><div class="fc"><div class="fc-in"><div class="fc-f"></div><div class="fc-b"></div></div></div><button type="button" class="fc-nav" data-next aria-label="Next">›</button></div>
    <div class="row fc-foot"><span class="muted small" data-n></span><span class="muted small">Tap the card to turn it</span><button type="button" class="btn ghost sm" data-add>Add to my review</button></div>`;
  const card = el.querySelector(".fc");
  const draw = () => {
    card.classList.remove("flip");
    el.querySelector(".fc-f").innerHTML = rich(cards[i]?.front || "");
    el.querySelector(".fc-b").innerHTML = rich(cards[i]?.back || "");
    el.querySelector("[data-n]").textContent = `${i + 1} / ${cards.length}`;
  };
  card.addEventListener("click", () => card.classList.toggle("flip"));
  el.querySelector("[data-prev]").addEventListener("click", () => {
    i = (i - 1 + cards.length) % cards.length;
    draw();
  });
  el.querySelector("[data-next]").addEventListener("click", () => {
    i = (i + 1) % cards.length;
    draw();
  });
  el.querySelector("[data-add]").addEventListener("click", async (e) => {
    const n = await on.cards?.(cards);
    e.target.textContent =
      n === undefined
        ? "Added"
        : n
          ? `Added ${n} to review`
          : "Already in your review";
    e.target.disabled = true;
  });
  if (cards.length) draw();
}
