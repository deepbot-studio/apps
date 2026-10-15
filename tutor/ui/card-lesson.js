/*
 * A LESSON OR A FEW EXERCISES IN THE CHAT: the same blocks as in Tutor (formulas, graphs,
 * simulations, questions checked on the spot), from a lesson file or written straight into the call.
 * Answers to a lesson from a course count toward the learner's progress.
 */
import { esc, inline, renderBlocks } from "./lib/blocks.js";
import { normaliseLesson, readCourse, readLesson } from "./lib/course.js";
import {
  addCards,
  loadProgress,
  recordAnswer,
  saveProgress,
} from "./lib/progress.js";

let args = {};

async function render() {
  const root = document.getElementById("root");
  let course = null;
  let lesson = null;
  try {
    if (args.course) course = await readCourse(String(args.course));
    if (args.course && args.lesson)
      lesson = await readLesson(String(args.course), String(args.lesson));
  } catch {
    /* fall back to inline blocks */
  }
  if (!lesson && Array.isArray(args.blocks))
    lesson = normaliseLesson({ title: args.title || "", blocks: args.blocks });
  if (!lesson) {
    root.innerHTML = `<div class="pad muted">Nothing to show yet.</div>`;
    return;
  }
  const kids = (course?.audience || args.audience) === "kids";
  document.documentElement.style.setProperty(
    "--accent",
    course?.colour || args.colour || "#4F46E5",
  );
  document.body.classList.toggle("kids", kids);
  const p = await loadProgress();
  root.innerHTML = `<div class="pad lesson">${course ? `<div class="lk">${esc(course.title)}</div>` : ""}${lesson.title ? `<div class="ltitle">${inline(lesson.title)}</div>` : ""}${args.note ? `<p class="note">${esc(args.note)}</p>` : ""}<div id="blocks" style="margin-top:12px"></div>
    ${course && args.lesson ? `<div class="acts"><button type="button" class="btn ghost sm" id="open">Open in Tutor</button></div>` : ""}</div>`;
  renderBlocks(document.getElementById("blocks"), lesson.blocks, {
    kids,
    on: {
      answer(id, ok) {
        if (!course || /s\d+$/.test(id)) return;
        recordAnswer(p, course.slug, lesson.id, id, ok);
        saveProgress(p);
      },
      async cards(cards) {
        const n = addCards(
          p,
          course?.slug || "chat",
          lesson.id || "chat",
          cards,
        );
        await saveProgress(p);
        return n;
      },
      ask: (text) => deepbot.ask(text),
    },
  });
  document
    .getElementById("open")
    ?.addEventListener("click", () =>
      deepbot.openPage("learn", { course: course.slug, lesson: lesson.id }),
    );
}

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
    t = setTimeout(render, 500);
  });
}
