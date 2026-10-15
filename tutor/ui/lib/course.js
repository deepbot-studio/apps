/*
 * COURSES ON DISK: tutor/<slug>/course.json (what the course is and its units and lessons) and
 * tutor/<slug>/lessons/<lesson>.json (the lesson's blocks). The Bot writes them; the app reads,
 * checks and fills in what is missing so a half-written file still shows.
 */

export const ROOT = "tutor";

export const AUDIENCES = {
  kids: "Children",
  teens: "Teens",
  adults: "Adults",
};

export const SUBJECT_COLOURS = {
  maths: "#4F46E5",
  math: "#4F46E5",
  physics: "#0EA5E9",
  chemistry: "#10B981",
  biology: "#16A34A",
  geography: "#0891B2",
  history: "#B45309",
  language: "#DB2777",
  languages: "#DB2777",
  literature: "#9333EA",
  economics: "#CA8A04",
  "social studies": "#EA580C",
  civics: "#EA580C",
  psychology: "#E11D48",
  philosophy: "#64748B",
  computing: "#7C3AED",
  programming: "#7C3AED",
  music: "#C026D3",
  art: "#F97316",
};

export function slugify(text) {
  return (
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "dj")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "course"
  );
}

const KIDS = [
  "#F97316",
  "#EC4899",
  "#14B8A6",
  "#8B5CF6",
  "#22C55E",
  "#0EA5E9",
  "#EF4444",
];

export function colourOf(course) {
  if (/^#[0-9a-f]{6}$/i.test(course.colour || "")) return course.colour;
  if (course.audience === "kids") {
    let h = 0;
    for (const ch of String(course.slug || course.title))
      h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return KIDS[h % KIDS.length];
  }
  const s = String(course.subject || "").toLowerCase();
  for (const [k, v] of Object.entries(SUBJECT_COLOURS))
    if (s.includes(k)) return v;
  return "#4F46E5";
}

/** Fill in a course so the screens never meet a missing field. */
export function normaliseCourse(raw, slug = "") {
  const c = raw && typeof raw === "object" ? { ...raw } : {};
  c.slug = c.slug || slug || slugify(c.title);
  c.title = c.title || "Untitled course";
  c.audience = AUDIENCES[c.audience] ? c.audience : "adults";
  c.units = (Array.isArray(c.units) ? c.units : []).map((u, i) => ({
    ...u,
    id: u.id || `unit-${i + 1}`,
    title: u.title || `Unit ${i + 1}`,
    lessons: (Array.isArray(u.lessons) ? u.lessons : []).map((l, j) => ({
      ...l,
      id: l.id || slugify(l.title) || `lesson-${i + 1}-${j + 1}`,
      title: l.title || `Lesson ${j + 1}`,
      minutes: Number(l.minutes) || 10,
    })),
  }));
  c.colour = colourOf(c);
  return c;
}

export function lessonsOf(course) {
  return course.units.flatMap((u) =>
    u.lessons.map((l) => ({ ...l, unit: u.id })),
  );
}

export const BLOCKS = new Set([
  "heading",
  "text",
  "math",
  "callout",
  "figure",
  "graph",
  "sim",
  "steps",
  "quiz",
  "exercise",
  "flashcards",
  "timeline",
  "table",
  "keyterms",
  "reflect",
  "compare",
]);

export function normaliseLesson(raw, id = "") {
  const l = raw && typeof raw === "object" ? { ...raw } : {};
  l.id = l.id || id;
  l.title = l.title || "Lesson";
  l.blocks = (Array.isArray(l.blocks) ? l.blocks : [])
    .filter((b) => b && typeof b === "object")
    .map((b) =>
      BLOCKS.has(b.type) ? b : { type: "text", text: b.text || "" },
    );
  return l;
}

/** How many answerable items a lesson has (each quiz question and each exercise). */
export function itemsIn(lesson) {
  let n = 0;
  for (const b of lesson.blocks) {
    if (b.type === "quiz") n += (b.questions || []).length;
    if (b.type === "exercise") n += 1;
  }
  return n;
}

export async function listCourses() {
  const top = await deepbot.files.list(ROOT).catch(() => ({ items: [] }));
  const out = [];
  for (const d of (top.items || []).filter((i) => i.dir)) {
    try {
      const raw = await deepbot.files.read(`${d.path}/course.json`, "json");
      out.push(normaliseCourse(raw, d.name));
    } catch {
      /* a folder without a course yet */
    }
  }
  return out;
}

export async function readCourse(slug) {
  const raw = await deepbot.files.read(`${ROOT}/${slug}/course.json`, "json");
  return normaliseCourse(raw, slug);
}

export async function readLesson(slug, id) {
  const raw = await deepbot.files.read(
    `${ROOT}/${slug}/lessons/${id}.json`,
    "json",
  );
  return normaliseLesson(raw, id);
}

/** Which lessons have their file written (the Bot may write a course plan first, lessons later). */
export async function writtenLessons(slug) {
  const r = await deepbot.files
    .list(`${ROOT}/${slug}/lessons`)
    .catch(() => ({ items: [] }));
  return new Set(
    (r.items || [])
      .filter((i) => i.name.endsWith(".json"))
      .map((i) => i.name.slice(0, -5)),
  );
}

/**
 * What is wrong in a lesson file, in words (empty when fine): answers that point at no option,
 * questions without an answer, unknown simulations, gaps without answers.
 */
export function lessonProblems(lesson, sims = null) {
  const out = [];
  lesson.blocks.forEach((b, i) => {
    const at = `block ${i + 1} (${b.type})`;
    if (b.type === "quiz")
      (b.questions || []).forEach((q, j) => {
        const w = `${at}, question ${j + 1}`;
        const kind = q.kind || (Array.isArray(q.options) ? "choice" : "");
        if (!q.prompt && kind !== "blank") out.push(`${w}: no prompt`);
        if (
          (kind === "choice" || kind === "multi") &&
          !Array.isArray(q.options)
        )
          out.push(`${w}: no options`);
        if (
          kind === "choice" &&
          !(
            Number.isInteger(q.answer) &&
            q.answer >= 0 &&
            q.answer < (q.options || []).length
          )
        )
          out.push(`${w}: answer must be the index of an option`);
        if (
          kind === "multi" &&
          !(
            Array.isArray(q.answer) &&
            q.answer.every(
              (a) =>
                Number.isInteger(a) && a >= 0 && a < (q.options || []).length,
            )
          )
        )
          out.push(`${w}: answer must be a list of option indexes`);
        if (kind === "truefalse" && typeof q.answer !== "boolean")
          out.push(`${w}: answer must be true or false`);
        if (
          (kind === "number" || kind === "expr" || kind === "text") &&
          (q.answer === undefined || q.answer === "")
        )
          out.push(`${w}: no answer`);
        if (kind === "blank" && !/\[\[.+?\]\]/.test(q.text || q.prompt || ""))
          out.push(`${w}: no [[gap]] in the text`);
        if (kind === "order" && !(q.items || []).length)
          out.push(`${w}: no items`);
        if (
          kind === "match" &&
          !(q.pairs || []).every((p) => Array.isArray(p) && p.length === 2)
        )
          out.push(`${w}: pairs must be [left, right]`);
      });
    if (b.type === "exercise")
      (b.steps || []).forEach((s, j) => {
        if (s.answer === undefined || s.answer === "")
          out.push(`${at}, step ${j + 1}: no answer`);
      });
    if (b.type === "sim" && sims && !sims[b.sim])
      out.push(`${at}: no simulation called "${b.sim}"`);
    if (
      b.type === "graph" &&
      !(b.functions || []).length &&
      !(b.points || []).length
    )
      out.push(`${at}: nothing to draw`);
    if (
      b.type === "flashcards" &&
      !(b.cards || []).every((c) => c.front && c.back)
    )
      out.push(`${at}: every card needs a front and a back`);
  });
  return out;
}
