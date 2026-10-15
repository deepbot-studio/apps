/*
 * A COURSE PLAN IN THE CHAT: the course the tutor proposes, unit by unit, with a button to start it in
 * Tutor and one to ask for changes.
 */
import { esc } from "./lib/blocks.js";
import {
  AUDIENCES,
  lessonsOf,
  normaliseCourse,
  readCourse,
} from "./lib/course.js";
import { coverSvg } from "./lib/cover.js";

let args = {};
let course = null;

async function render() {
  const root = document.getElementById("root");
  try {
    course = args.course
      ? await readCourse(String(args.course))
      : args.title
        ? normaliseCourse(args)
        : null;
  } catch {
    course = null;
  }
  if (!course) {
    root.innerHTML = `<div class="pad muted">No course "${esc(args.course || "")}" yet.</div>`;
    return;
  }
  const c = course;
  document.documentElement.style.setProperty("--accent", c.colour);
  document.body.classList.toggle("kids", c.audience === "kids");
  const all = lessonsOf(c);
  root.innerHTML = `<div class="chead"><div class="cv">${coverSvg(c, 760, 128)}</div><div class="cin"><div class="tag">Tutor · ${esc(AUDIENCES[c.audience])}${c.level ? ` · ${esc(c.level)}` : ""} · ${all.length} lessons · ${all.reduce((a, l) => a + l.minutes, 0)} min</div><b>${esc(c.title)}</b></div></div>
    <div class="pad">${args.note ? `<p class="note">${esc(args.note)}</p>` : c.goal ? `<p class="note">${esc(c.goal)}</p>` : ""}
    <div class="units">${c.units
      .map(
        (u, i) =>
          `<div class="cu"><div class="h"><span>Unit ${i + 1}</span><b>${esc(u.title)}</b></div><ol>${u.lessons.map((l) => `<li>${esc(l.title)} <span class="m">· ${l.minutes} min</span></li>`).join("")}</ol></div>`,
      )
      .join("")}</div>
    <div class="acts"><button type="button" class="btn ghost sm" id="change">Change something</button><button type="button" class="btn" id="start">Start learning →</button></div></div>`;
}

document.addEventListener("click", (e) => {
  if (!course) return;
  if (e.target.closest("#start"))
    deepbot.openPage("learn", { course: course.slug });
  if (e.target.closest("#change")) {
    const box = document.querySelector(".acts");
    box.innerHTML = `<input class="in" id="what" placeholder="e.g. fewer lessons, more about graphs" style="flex:1"><button type="button" class="btn sm" id="send">Send</button>`;
    document.getElementById("what").focus();
  }
  if (e.target.closest("#send")) {
    const v = document.getElementById("what").value.trim();
    if (v) deepbot.ask(`Change the course plan "${course.title}": ${v}`);
  }
});

if (window.deepbot) {
  deepbot.ready.then(async (init) => {
    args = init.args || {};
    await render();
    deepbot.done();
  });
  let t = null;
  deepbot.on("args", (n) => {
    args = n || {};
    clearTimeout(t);
    t = setTimeout(render, 400);
  });
}
