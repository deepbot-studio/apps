/*
 * TUTOR: the learner's own place. A library of courses the Bot wrote for them, each course as a map
 * of units and lessons (a path of stars for children), the lesson itself with every exercise
 * checked on the spot, a finish screen, flashcard review on a spaced-repetition schedule, and the
 * progress page (streak, points, a year of activity, every course). "Ask the tutor" anywhere starts a
 * conversation with the Bot about exactly where the learner is.
 */
import { celebrate, esc, inline, renderBlocks, rich } from "./lib/blocks.js";
import {
	AUDIENCES,
	itemsIn,
	lessonProblems,
	lessonsOf,
	listCourses,
	readCourse,
	ROOT,
	readLesson,
	writtenLessons,
} from "./lib/course.js";
import { coverSvg } from "./lib/cover.js";
import {
	addCards,
	courseProgress,
	dueCards,
	finishLesson,
	forgetCourse,
	lessonScore,
	lessonState,
	loadProgress,
	nextIn,
	recordAnswer,
	review,
	saveProgress,
	streak,
	today,
} from "./lib/progress.js";
import { SIMS } from "./lib/sims.js";

const $ = (s) => document.querySelector(s);
const root = () => $("#root");
const ui = {
	view: "home",
	courses: [],
	course: null,
	lesson: null,
	p: null,
	written: new Set(),
};

function setTheme(course) {
	document.documentElement.style.setProperty(
		"--accent",
		course?.colour || "#4F46E5",
	);
	document.body.classList.toggle("kids", course?.audience === "kids");
}

function starsHtml(n, max = 3) {
	return `<span class="stars">${"★".repeat(n)}<span class="off">${"★".repeat(max - n)}</span></span>`;
}

function ringSvg(share, colour, size = 36, stroke = 5) {
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	return `<svg class="ring" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * Math.min(1, share)).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

/* A line to the Bot. What the app knows about the job goes as instructions the Bot reads and the
 * conversation does not show, where DeepBot keeps the conversation beside the page ("ask-beside");
 * an older DeepBot gets it in front of the words, as before. */
function ask(text, context = "") {
	(context && deepbot.features?.includes("ask-beside")
		? deepbot.ask(text, { instructions: [context] })
		: deepbot.ask(context ? `${context} ${text}` : text)
	).catch(() => {});
}

/* -------------------------------------------------------------------------- home */

const IDEAS = [
	"Fractions for a 9-year-old",
	"Quadratic equations, from zero",
	"Newton's laws with simulations",
	"The French Revolution in 6 lessons",
	"Supply and demand",
	"Cells and what is inside them",
	"Probability for the final exam",
	"Python for complete beginners",
];

async function home() {
	ui.view = "home";
	setTheme(null);
	ui.courses = await listCourses();
	const p = ui.p;
	const due = dueCards(p).length;
	const todayXp = p.days[today()] || 0;
	const st = streak(p);
	// the course touched most recently, and its next lesson
	let cont = null;
	let lastAt = 0;
	for (const c of ui.courses) {
		for (const l of lessonsOf(c)) {
			const s = lessonState(p, c.slug, l.id);
			if (s?.last > lastAt) {
				lastAt = s.last;
				cont = c;
			}
		}
	}
	const cp = cont ? courseProgress(p, cont) : null;
	root().innerHTML = `<div class="wrap">
    <div class="head-row"><div><h1 class="h1">Learning</h1><div class="sub">Courses made for you, lessons you do, and everything you remember.</div></div>
      <div class="stats">
        <div class="stat"><div class="ic">🔥</div><div><b>${st}</b><span>day streak</span></div></div>
        <div class="stat">${ringSvg(todayXp / (p.goal || 20), "#10B981")}<div><b>${todayXp} / ${p.goal || 20}</b><span>points today</span></div></div>
        <button type="button" class="stat" data-review style="cursor:pointer;font:inherit;color:inherit"><div class="ic">🗂️</div><div style="text-align:left"><b>${due}</b><span>cards to review</span></div></button>
        <button type="button" class="btn ghost" data-progress>Progress</button>
      </div></div>
    ${
			cont && cp?.next
				? `<div class="cont" style="--accent:${cont.colour}"><div class="cv">${coverSvg(cont, 440, 248)}</div><div class="tx"><div class="k">Continue · ${esc(cont.title)}</div><b>${esc(cp.next.title)}</b><div class="muted small">${cp.done} of ${cp.total} lessons done · about ${cp.next.minutes} min</div></div><div class="go"><button type="button" class="btn lg" data-open-lesson="${esc(cont.slug)}|${esc(cp.next.id)}">Continue →</button></div></div>`
				: ""
		}
    <div class="sec">Your courses</div>
    ${
			ui.courses.length
				? `<div class="tiles">${ui.courses.map(tile).join("")}${newCourseBox()}</div>`
				: `<div class="empty"><div style="font-size:42px">🎓</div><div class="big">What do you want to learn?</div><div class="muted">Say what, for whom and why. The tutor plans a course, writes the lessons with exercises, graphs and simulations, and checks every answer.</div>
            <div style="max-width:560px;margin:18px auto 0">${newCourseForm()}</div>
            <div class="ideas">${IDEAS.map((i) => `<button type="button" class="idea" data-idea="${esc(i)}">${esc(i)}</button>`).join("")}</div></div>`
		}
  </div>`;
}

function tile(c) {
	const cp = courseProgress(ui.p, c);
	return `<div class="tile" role="button" tabindex="0" style="--accent:${c.colour}" data-course="${esc(c.slug)}"><div class="cv">${coverSvg(c, 320, 132)}<span class="badge">${esc(AUDIENCES[c.audience])}${c.level ? ` · ${esc(c.level)}` : ""}</span><button type="button" class="more" data-more-course="${esc(c.slug)}" title="More" aria-label="More">⋯</button></div>
    <div class="bd"><b>${esc(c.title)}</b><div class="meta">${esc(c.subject || "")}${c.subject ? " · " : ""}${cp.total} lessons</div>
    <div class="bar"><i style="width:${Math.round(cp.share * 100)}%"></i></div><div class="pl"><span>${cp.done ? `${cp.done} done` : cp.accuracy !== null ? "Started" : "Not started"}</span><span>${cp.accuracy !== null ? `${Math.round(cp.accuracy * 100)}% right` : ""}</span></div></div></div>`;
}

function newCourseForm() {
	return `<textarea class="in" id="want" rows="3" placeholder="e.g. Linear equations for my son in 6th grade"></textarea>
    <div class="row"><select class="in" id="who"><option value="adults">For an adult</option><option value="teens">For a teenager</option><option value="kids">For a child</option></select><button type="button" class="btn" data-make>Make the course</button></div>`;
}
function newCourseBox() {
	return `<div class="newc"><b>A new course</b>${newCourseForm()}</div>`;
}

function makeCourse(text, who) {
	if (!text.trim()) return $("#want")?.focus();
	ask(
		text.trim(),
		`I want to learn with the Tutor app (${who === "kids" ? "for a child" : who === "teens" ? "for a teenager" : "for an adult"}). Ask me what you need to know first, then plan the course and write the lessons.`,
	);
}

/* -------------------------------------------------------------------------- course */

async function course(slug) {
	ui.view = "course";
	const c = await readCourse(slug);
	ui.course = c;
	ui.written = await writtenLessons(slug);
	setTheme(c);
	const cp = courseProgress(ui.p, c);
	const due = dueCards(ui.p, { course: slug }).length;
	const lessons = lessonsOf(c);
	const nextId = cp.next?.id;
	const state = (l) => {
		const s = lessonState(ui.p, slug, l.id);
		const total = ui.itemsCache?.[`${slug}/${l.id}`] ?? 0;
		return { s, sc: lessonScore(s, total) };
	};
	const kids = c.audience === "kids";
	let n = 0;
	const units = c.units
		.map((u, ui2) => {
			if (kids) {
				const nodes = u.lessons
					.map((l, j) => {
						n++;
						const { s, sc } = state(l);
						const cls = s?.done
							? "done"
							: l.id === nextId
								? "next"
								: ui.written.has(l.id)
									? ""
									: "later";
						const x = [0, 90, 150, 90, 0, -90, -150, -90][(n - 1) % 8];
						return `<div class="node ${cls}" data-lesson="${esc(l.id)}" style="margin-left:calc(50% - 75px + ${x}px)"><div class="dot">${s?.done ? "★" : n}</div><div class="lbl">${esc(l.title)}</div>${s?.done ? starsHtml(sc.stars) : ""}${j < 0 ? "" : ""}</div>`;
					})
					.join("");
				return `<div class="unit-band">${esc(u.title)}</div><div class="path">${nodes}</div>`;
			}
			return `<div class="unit"><div class="unit-h"><span class="n">Unit ${ui2 + 1}</span><b>${esc(u.title)}</b></div>${u.summary ? `<div class="unit-s">${esc(u.summary)}</div>` : ""}${u.lessons
				.map((l) => {
					n++;
					const { s, sc } = state(l);
					const written = ui.written.has(l.id);
					const cls = s?.done
						? "done"
						: l.id === nextId
							? "next"
							: written
								? ""
								: "later";
					return `<div class="lrow ${cls}" data-lesson="${esc(l.id)}"><div class="st">${s?.done ? "✓" : n}</div><div class="t"><b>${esc(l.title)}</b><span>${l.summary ? `${esc(l.summary)} · ` : ""}${l.minutes} min${written ? "" : " · not written yet"}</span></div><div>${s?.done ? starsHtml(sc.stars) : l.id === nextId && written ? `<span class="btn sm">Start</span>` : ""}</div></div>`;
				})
				.join("")}</div>`;
		})
		.join("");
	const missing = lessons.filter((l) => !ui.written.has(l.id));
	root().innerHTML = `<div class="wrap">
    <button type="button" class="back" data-home>← All courses</button>
    <div class="hero"><div class="cv">${coverSvg(c, 1100, 220)}</div><div class="hin">
      <div class="tags"><span>${esc(AUDIENCES[c.audience])}</span>${c.level ? `<span>${esc(c.level)}</span>` : ""}${c.subject ? `<span>${esc(c.subject)}</span>` : ""}<span>${lessons.length} lessons · ${lessons.reduce((a, l) => a + l.minutes, 0)} min</span></div>
      <h1>${esc(c.title)}</h1>${c.goal ? `<p>${esc(c.goal)}</p>` : ""}</div></div>
    <div class="cgrid"><div>${units}</div>
      <div class="side">
        <div class="box"><h4>Your progress</h4><div class="row" style="gap:14px">${ringSvg(cp.share, c.colour, 64, 8)}<div><b style="font-size:22px">${Math.round(cp.share * 100)}%</b><div class="muted small">${cp.done} of ${cp.total} lessons${cp.accuracy !== null ? ` · ${Math.round(cp.accuracy * 100)}% right first time` : ""}</div></div></div>
          ${cp.next && ui.written.has(cp.next.id) ? `<button type="button" class="btn" style="width:100%;margin-top:12px" data-lesson="${esc(cp.next.id)}">${cp.done ? "Next lesson" : "Start the course"} →</button>` : ""}</div>
        <div class="box"><h4>Flashcards</h4><div class="muted small">${cp.cards} cards from this course · ${cp.learned} learned for good</div><button type="button" class="btn ghost sm" style="margin-top:8px" data-review="${esc(slug)}" ${due ? "" : "disabled"}>Review ${due} due</button></div>
        <div class="box"><h4>The tutor</h4><div class="muted small">Stuck, curious, or want it another way? Ask about this course.</div>
          <div class="row" style="margin-top:8px"><button type="button" class="btn ghost sm" data-ask-course>Ask the tutor</button>${missing.length ? `<button type="button" class="btn ghost sm" data-write>Write the next lessons</button>` : ""}<button type="button" class="btn ghost sm" data-test>A test for this course</button></div></div>
        <div class="box"><button type="button" class="linkdanger" data-delete-course="${esc(slug)}">Delete this course</button></div>
      </div></div></div>`;
	// number of items per lesson, for stars (read lazily)
	lazyItems(c);
}

async function lazyItems(c) {
	ui.itemsCache = ui.itemsCache || {};
	let changed = false;
	for (const l of lessonsOf(c)) {
		const k = `${c.slug}/${l.id}`;
		if (
			k in ui.itemsCache ||
			!ui.written.has(l.id) ||
			!lessonState(ui.p, c.slug, l.id)?.done
		)
			continue;
		try {
			ui.itemsCache[k] = itemsIn(await readLesson(c.slug, l.id));
			changed = true;
		} catch {
			ui.itemsCache[k] = 0;
		}
	}
	if (changed && ui.view === "course" && ui.course?.slug === c.slug)
		course(c.slug);
}

/* -------------------------------------------------------------------------- lesson */

async function lesson(slug, id) {
	ui.view = "lesson";
	ui.lessonId = id;
	$("#changed")?.remove();
	const c = ui.course?.slug === slug ? ui.course : await readCourse(slug);
	ui.course = c;
	setTheme(c);
	let l;
	try {
		l = await readLesson(slug, id);
	} catch {
		const meta = lessonsOf(c).find((x) => x.id === id);
		ui.view = "missing";
		ui.missing = { slug, id };
		root().innerHTML = `<div class="wrap"><button type="button" class="back" data-course="${esc(slug)}">← ${esc(c.title)}</button><div class="empty"><div class="big">${esc(meta?.title || "This lesson")} is not written yet</div><div class="muted">The tutor writes lessons as you go.</div><button type="button" class="btn" style="margin-top:14px" data-write-one="${esc(id)}">Ask the tutor to write it</button></div></div>`;
		return;
	}
	ui.lesson = l;
	const all = lessonsOf(c);
	const idx = all.findIndex((x) => x.id === id);
	const meta = all[idx] || {};
	const total = itemsIn(l);
	const kids = c.audience === "kids";
	root().innerHTML = `<div class="lesson">
    <div class="lbar"><div class="lin"><button type="button" class="x" data-course="${esc(slug)}" title="Back to the course">✕</button>
      <div><div class="ttl">${esc(c.title)} · Lesson ${idx + 1} of ${all.length}</div><div class="bar"><i id="lprog" style="width:0%"></i></div></div>
      <div class="muted small" id="lcount">${total ? `0 / ${total}` : ""}</div></div></div>
    <div class="lbody"><div class="lhead"><div class="k">${esc(c.units.find((u) => u.id === meta.unit)?.title || c.subject || "")}</div><h1>${inline(l.title)}</h1></div>
      ${l.objectives?.length ? `<div class="goals"><b>${kids ? "Today you will" : "By the end you can"}</b><ul>${l.objectives.map((o) => `<li>${inline(o)}</li>`).join("")}</ul></div>` : ""}
      ${(() => {
				const probs = lessonProblems(l, SIMS);
				return probs.length
					? `<div class="hint" style="margin-bottom:18px"><b>This lesson file has ${probs.length} problem${probs.length > 1 ? "s" : ""}</b> (the tutor can fix them): ${esc(probs.slice(0, 4).join("; "))}</div>`
					: "";
			})()}
      <div id="blocks"></div>
      <div class="lfoot"><span class="muted small">${l.minutes || meta.minutes || 10} min${total ? ` · ${total} questions` : ""}</span><button type="button" class="btn lg" data-finish>${kids ? "I'm done! 🎉" : "Finish the lesson"}</button></div>
    </div>
    <button type="button" class="askfab" data-askopen>💬 Ask the tutor</button></div>`;
	const reflections = ui.p.reflect?.[`${slug}/${id}`] || {};
	const update = () => {
		const s = lessonState(ui.p, slug, id);
		const n = Object.keys(s?.answers || {}).filter(
			(k) => !k.includes("s"),
		).length;
		const share = total ? Math.min(1, n / total) : 0;
		$("#lprog").style.width = `${Math.round(share * 100)}%`;
		// a lesson rewritten shorter keeps its old answers: never "11 / 8"
		if (total) $("#lcount").textContent = `${Math.min(n, total)} / ${total}`;
	};
	renderBlocks($("#blocks"), l.blocks, {
		kids,
		lang: c.language || undefined,
		reflections,
		on: {
			answer(itemId, ok) {
				// exercise steps (b3s0) count only through their exercise (b3)
				if (/s\d+$/.test(itemId)) return;
				recordAnswer(ui.p, slug, id, itemId, ok);
				saveProgress(ui.p);
				update();
			},
			async cards(cards) {
				const n = addCards(ui.p, slug, id, cards);
				await saveProgress(ui.p);
				return n;
			},
			reflect(i, text) {
				ui.p.reflect = ui.p.reflect || {};
				ui.p.reflect[`${slug}/${id}`] = {
					...(ui.p.reflect[`${slug}/${id}`] || {}),
					[i]: text,
				};
				saveProgress(ui.p);
			},
			ask: (text) =>
				ask(
					text,
					`[Tutor · course "${c.title}" (tutor/${slug}) · lesson "${l.title}" (lessons/${id}.json)]`,
				),
		},
	});
	update();
	$("#root").scrollTop = 0;
}

async function finish() {
	const c = ui.course;
	const l = ui.lesson;
	const total = itemsIn(l);
	// the lesson's flashcards go into the review deck
	for (const b of l.blocks)
		if (b.type === "flashcards") addCards(ui.p, c.slug, l.id, b.cards || []);
	const sc = finishLesson(ui.p, c.slug, l.id, total);
	// the lesson's cards in the review now, added here or with "Add to my review" before
	const inReview = Object.values(ui.p.cards).filter(
		(x) => x.course === c.slug && x.lesson === l.id,
	).length;
	ui.itemsCache = { ...(ui.itemsCache || {}), [`${c.slug}/${l.id}`]: total };
	await saveProgress(ui.p);
	const all = lessonsOf(c);
	const next = all[all.findIndex((x) => x.id === l.id) + 1];
	const kids = c.audience === "kids";
	const words =
		sc.stars === 3
			? kids
				? "Amazing!"
				: "Excellent work."
			: sc.stars === 2
				? kids
					? "Great job!"
					: "Well done."
				: kids
					? "You did it!"
					: "Lesson done.";
	ui.view = "finish";
	root().innerHTML = `<div class="wrap"><div class="fin" id="fin">
    <div class="bstars">${"★".repeat(sc.stars)}<span class="off">${"★".repeat(3 - sc.stars)}</span></div>
    <div class="big">${words}</div><div class="muted">${esc(l.title)}</div>
    <div class="figs"><div><b>${total ? `${Math.round(sc.score * 100)}%` : "✓"}</b><span>${total ? "right first time" : "done"}</span></div><div><b>+${lessonState(ui.p, c.slug, l.id)?.xp || 20}</b><span>points</span></div><div><b>${inReview}</b><span>${inReview === 1 ? "flashcard" : "flashcards"} to review</span></div></div>
    ${sc.stars < 3 && total ? `<div class="muted small" style="margin-bottom:14px">${kids ? "Want all three stars? Try the lesson again later!" : "The questions you missed come back better after a day. Review, or ask the tutor for more practice."}</div>` : ""}
    <div class="row" style="justify-content:center">
      <button type="button" class="btn ghost" data-course="${esc(c.slug)}">Back to the course</button>
      <button type="button" class="btn ghost" data-more>More practice like this</button>
      ${next ? `<button type="button" class="btn" data-open-lesson="${esc(c.slug)}|${esc(next.id)}">Next: ${esc(next.title)} →</button>` : `<button type="button" class="btn" data-ask-course>Course finished! What next?</button>`}
    </div></div></div>`;
	celebrate($("#fin .bstars"), true);
}

/* -------------------------------------------------------------------------- review */

let session = null;
function startReview(courseSlug = null) {
	const cards = dueCards(ui.p, { course: courseSlug }).slice(0, 40);
	session = {
		cards,
		i: 0,
		shown: false,
		done: 0,
		again: 0,
		course: courseSlug,
	};
	setTheme(
		courseSlug
			? ui.courses.find((c) => c.slug === courseSlug) || ui.course
			: null,
	);
	drawReview();
}

function drawReview() {
	ui.view = "review";
	const s = session;
	const card = s.cards[s.i];
	if (!card) {
		root().innerHTML = `<div class="wrap"><div class="fin" id="fin"><div style="font-size:52px">🗂️</div><div class="big">${s.done ? "All reviewed" : "Nothing to review"}</div><div class="muted">${s.done ? `${s.done} cards. They come back when you are about to forget them.` : "Cards come from lessons you finish. They come back when you are about to forget them."}</div><div class="row" style="justify-content:center;margin-top:20px"><button type="button" class="btn" data-home>Done</button></div></div></div>`;
		if (s.done) celebrate($("#fin .big"), true);
		return;
	}
	const c = ui.courses.find((x) => x.slug === card.course);
	root().innerHTML = `<div class="wrap"><div class="rev">
    <div class="row" style="justify-content:space-between"><button type="button" class="back" data-home>← Stop</button><span class="muted small">${s.i + 1} of ${s.cards.length}</span></div>
    <div class="bar"><i style="width:${(s.i / s.cards.length) * 100}%"></i></div>
    <div class="rcard" ${s.shown ? "" : 'data-flip role="button" tabindex="0" title="Show the answer (Space)"'}><span class="from">${esc(c?.title || (card.course === "chat" ? "From the chat" : card.course))}</span><div><div>${rich(card.front)}</div>${s.shown ? `<div class="ans pop">${rich(card.back)}</div>` : ""}</div></div>
    ${
			s.shown
				? `<div class="grades">${["Again", "Hard", "Good", "Easy"].map((g, i) => `<button type="button" class="g${i}" data-grade="${i}">${g}<span>${nextIn(card, i)}</span></button>`).join("")}</div>`
				: `<button type="button" class="btn lg" style="width:100%" data-flip>Show the answer</button>`
		}
  </div></div>`;
}

function grade(g) {
	const s = session;
	const card = s.cards[s.i];
	const { id, ...rest } = card;
	ui.p.cards[id] = review(rest, g);
	if (g === 0) s.cards.push({ id, ...ui.p.cards[id] });
	else s.done++;
	// points: a little for each review
	ui.p.xp += 1;
	ui.p.days[today()] = (ui.p.days[today()] || 0) + 1;
	saveProgress(ui.p);
	s.i++;
	s.shown = false;
	drawReview();
}

/* -------------------------------------------------------------------------- progress */

async function progress() {
	ui.view = "progress";
	setTheme(null);
	if (!ui.courses.length) ui.courses = await listCourses();
	const p = ui.p;
	const doneLessons = Object.values(p.lessons).filter((s) => s.done).length;
	const allAns = Object.values(p.lessons).flatMap((s) =>
		Object.values(s.answers || {}),
	);
	const acc = allAns.length
		? Math.round((allAns.filter((a) => a.first).length / allAns.length) * 100)
		: null;
	// 20 weeks of activity, Monday first
	const DAY = 86400000;
	const now = new Date();
	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startDay = new Date(end.getTime() - (20 * 7 - 1) * DAY);
	const shift = (startDay.getDay() + 6) % 7;
	const cells = [];
	for (let i = 0; i < shift; i++)
		cells.push(`<i style="visibility:hidden"></i>`);
	for (let t = startDay.getTime(); t <= end.getTime(); t += DAY) {
		const v = p.days[today(t)] || 0;
		const lvl =
			v === 0 ? "" : v < 10 ? "l1" : v < 25 ? "l2" : v < 50 ? "l3" : "l4";
		cells.push(`<i class="${lvl}" title="${today(t)}: ${v} points"></i>`);
	}
	root().innerHTML = `<div class="wrap"><button type="button" class="back" data-home>← Learning</button><h1 class="h1">Progress</h1>
    <div class="pgrid" style="margin-top:18px">
      <div class="box"><b>🔥 ${streak(p)}</b><span>day streak</span></div>
      <div class="box"><b>${p.xp.toLocaleString("en")}</b><span>points in all</span></div>
      <div class="box"><b>${doneLessons}</b><span>lessons finished</span></div>
      <div class="box"><b>${acc === null ? "-" : `${acc}%`}</b><span>right the first time</span></div>
    </div>
    <div class="sec">Activity, last 20 weeks</div><div class="box"><div class="heat">${cells.join("")}</div></div>
    <div class="sec">Courses</div><div class="box">${
			ui.courses.length
				? ui.courses
						.map((c) => {
							const cp = courseProgress(p, c);
							return `<div class="crow" style="--accent:${c.colour}"><span><b>${esc(c.title)}</b> <span class="muted small">· ${cp.done}/${cp.total} lessons · ${cp.learned}/${cp.cards} cards learned</span></span><div class="bar"><i style="width:${Math.round(cp.share * 100)}%"></i></div><span class="small" style="text-align:right">${Math.round(cp.share * 100)}%</span></div>`;
						})
						.join("")
				: `<div class="muted">No courses yet.</div>`
		}</div>
    <div class="sec">Daily goal</div><div class="box row"><span>Points a day:</span>${[10, 20, 40, 80].map((g) => `<button type="button" class="btn ${p.goal === g ? "" : "ghost"} sm" data-goal="${g}">${g}</button>`).join("")}<span class="muted small">A lesson is about 40 to 80, a review card 1.</span></div>
  </div>`;
}

/* -------------------------------------------------------------------------- the ask box */

function askBox() {
	const open = $(".askbox");
	if (open) return open.remove();
	const c = ui.course;
	const l = ui.lesson;
	const box = document.createElement("div");
	box.className = "askbox pop";
	box.innerHTML = `<b>Ask the tutor</b><div class="muted small">About "${esc(l?.title || c?.title || "")}". A conversation opens with the Bot.</div>
    <textarea class="in" rows="3" placeholder="What isn't clear?"></textarea>
    <div class="q">${["Explain it another way", "Give me an easier example", "Why does this work?", "More practice"].map((q) => `<button type="button" class="idea" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn sm" data-send>Ask</button></div>`;
	document.querySelector(".lesson").appendChild(box);
	box.querySelector("textarea").focus();
	const send = (text) => {
		if (!text.trim()) return;
		ask(
			text.trim(),
			`[Tutor · course "${c?.title}" (tutor/${c?.slug}) · lesson "${l?.title}" (lessons/${l?.id}.json)]`,
		);
		box.innerHTML = `<b>Sent to the tutor ✓</b><div class="muted small">${deepbot.features?.includes("ask-beside") ? "The answer comes in the conversation beside the lesson." : "The answer is in the new conversation."}</div>`;
		setTimeout(() => box.remove(), 2200);
	};
	box.addEventListener("click", (e) => {
		const q = e.target.dataset.q;
		if (q) send(q);
		if (e.target.dataset.send !== undefined)
			send(box.querySelector("textarea").value);
	});
}

/* -------------------------------------------------------------------------- deleting a course */

function closeMenus() {
	// "cmenu", not "pop": .pop is the little arrival animation lesson steps and answers use
	for (const m of document.querySelectorAll(".cmenu")) m.remove();
}

function popAt(html, anchor, at) {
	closeMenus();
	const m = document.createElement("div");
	m.className = "cmenu";
	m.innerHTML = html;
	document.body.appendChild(m);
	const r = anchor
		? anchor.getBoundingClientRect()
		: { left: at.x, bottom: at.y, right: at.x };
	const w = m.offsetWidth;
	m.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
	m.style.top = `${Math.max(8, Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8))}px`;
	setTimeout(() => {
		const away = (e) => {
			if (!m.contains(e.target)) {
				m.remove();
				removeEventListener("mousedown", away, true);
			}
		};
		addEventListener("mousedown", away, true);
	}, 0);
	return m;
}

function courseMenu(slug, anchor, at) {
	const c = ui.courses.find((x) => x.slug === slug);
	const m = popAt(
		`<button type="button" data-cm="open">Open</button><button type="button" data-cm="delete" class="danger">Delete…</button>`,
		anchor,
		at,
	);
	m.addEventListener("click", (e) => {
		const a = e.target.closest("[data-cm]")?.dataset.cm;
		if (!a) return;
		m.remove();
		if (a === "open") course(slug);
		else confirmDelete(slug, c?.title || slug, anchor, at);
	});
}

function confirmDelete(slug, title, anchor, at) {
	const m = popAt(
		`<div class="confirm"><b>Delete "${esc(title)}"?</b><div class="muted small">Its lessons, your progress in it and its flashcards go. This cannot be undone.</div><div class="row"><button type="button" class="btn sm danger" data-yes>Delete</button><button type="button" class="btn ghost sm" data-no>Cancel</button></div></div>`,
		anchor,
		at,
	);
	m.addEventListener("click", async (e) => {
		if (e.target.closest("[data-no]")) return m.remove();
		if (!e.target.closest("[data-yes]")) return;
		m.innerHTML = `<div class="confirm muted small">Deleting…</div>`;
		try {
			await deepbot.files.delete(`tutor/${slug}`);
			forgetCourse(ui.p, slug);
			await saveProgress(ui.p);
			m.remove();
			ui.course = null;
			home();
		} catch (error) {
			m.innerHTML = `<div class="confirm"><b>Could not delete it.</b><div class="muted small">${esc(error?.message || error)}</div></div>`;
		}
	});
}

document.addEventListener("contextmenu", (e) => {
	const t = e.target.closest?.(".tile[data-course]");
	if (!t) return;
	e.preventDefault();
	courseMenu(t.dataset.course, null, { x: e.clientX, y: e.clientY });
});

/* -------------------------------------------------------------------------- events */

document.addEventListener("click", async (e) => {
	const more = e.target.closest("[data-more-course]");
	if (more) {
		e.stopPropagation();
		return courseMenu(more.dataset.moreCourse, more);
	}
	const del = e.target.closest("[data-delete-course]");
	if (del)
		return confirmDelete(
			del.dataset.deleteCourse,
			ui.course?.title || del.dataset.deleteCourse,
			del,
		);
	if (e.target.closest("[data-reload-lesson]")) {
		$("#changed")?.remove();
		const at = ui.lessonId;
		if (ui.course && at) return void lesson(ui.course.slug, at);
	}
	const t = e.target.closest(
		"[data-course],[data-lesson],[data-open-lesson],[data-home],[data-review],[data-progress],[data-finish],[data-flip],[data-grade],[data-idea],[data-make],[data-askopen],[data-ask-course],[data-write],[data-write-one],[data-test],[data-more],[data-goal]",
	);
	if (!t) return;
	const d = t.dataset;
	if (d.idea) {
		$("#want").value = d.idea;
		$("#want").focus();
	} else if (d.make !== undefined)
		makeCourse($("#want").value, $("#who").value);
	else if (d.openLesson) {
		const [s, l] = d.openLesson.split("|");
		lesson(s, l);
	} else if (d.lesson && ui.course) lesson(ui.course.slug, d.lesson);
	else if (d.course !== undefined && d.course) course(d.course);
	else if (d.home !== undefined) home();
	else if (d.review !== undefined) startReview(d.review || null);
	else if (d.progress !== undefined) progress();
	else if (d.finish !== undefined) finish();
	else if (d.flip !== undefined) {
		session.shown = true;
		drawReview();
	} else if (d.grade !== undefined) grade(Number(d.grade));
	else if (d.askopen !== undefined) askBox();
	else if (d.askCourse !== undefined)
		ask(
			"I have a question about this course.",
			`[Tutor · course "${ui.course.title}" (tutor/${ui.course.slug})]`,
		);
	else if (d.write !== undefined)
		ask(
			"Please write the next lessons of this course that are not written yet.",
			`[Tutor · course "${ui.course.title}" (tutor/${ui.course.slug})]`,
		);
	else if (d.writeOne)
		ask(
			`Please write the lesson "${lessonsOf(ui.course).find((x) => x.id === d.writeOne)?.title || d.writeOne}" now.`,
			`[Tutor · course "${ui.course.title}" (tutor/${ui.course.slug}) · the lesson's id is ${d.writeOne}]`,
		);
	else if (d.test !== undefined)
		ask(
			"Make me a test lesson for what I have done in this course so far, focused on what I got wrong.",
			`[Tutor · course "${ui.course.title}" (tutor/${ui.course.slug})]`,
		);
	else if (d.more !== undefined)
		ask(
			"Add more practice like this lesson's exercises, a bit harder.",
			`[Tutor · course "${ui.course.title}" (tutor/${ui.course.slug}) · lesson "${ui.lesson.title}" (lessons/${ui.lesson.id}.json)]`,
		);
	else if (d.goal) {
		ui.p.goal = Number(d.goal);
		await saveProgress(ui.p);
		progress();
	}
});

/*
 * THE TUTOR WRITES WHILE THE PAGE IS OPEN ("Ask the tutor" keeps the conversation beside the page):
 * a new course shows up on the home page, new lessons on the course page, and a lesson the person
 * is waiting for opens by itself. A lesson being worked through is never swapped under the learner:
 * they are told it changed and choose when to reload it.
 */
async function lookAt(dir) {
	const r = await deepbot.files.list(dir).catch(() => null);
	return r
		? (r.items || [])
				.map((i) => `${i.name}:${i.size ?? ""}:${i.modified ?? ""}`)
				.join("|")
		: null;
}
async function watchSig() {
	if (ui.view === "home") {
		const top = await lookAt(ROOT);
		const courses = await listCourses().catch(() => []);
		return `${top}#${courses.map((c) => `${c.slug}:${c.title}:${lessonsOf(c).length}`).join("|")}`;
	}
	if (ui.view === "course" && ui.course) {
		const c = await deepbot.files
			.read(`${ROOT}/${ui.course.slug}/course.json`, "text")
			.catch(() => "");
		return `${c.length}:${c}#${await lookAt(`${ROOT}/${ui.course.slug}/lessons`)}`;
	}
	if ((ui.view === "lesson" || ui.view === "missing") && ui.course) {
		return lookAt(`${ROOT}/${ui.course.slug}/lessons`);
	}
	return null;
}
let watched = { view: null, sig: null };
async function watchTutor() {
	if (document.hidden) return;
	const view = ui.view;
	const at =
		view === "missing"
			? JSON.stringify(ui.missing)
			: `${view}:${ui.course?.slug || ""}`;
	const sig = await watchSig();
	if (sig === null || ui.view !== view) return;
	if (watched.view !== at) {
		watched = { view: at, sig };
		return;
	}
	if (sig === watched.sig) return;
	watched.sig = sig;
	if (view === "home") {
		const draft = $("#want")?.value || "";
		await home();
		if (draft && $("#want")) $("#want").value = draft;
	} else if (view === "course") await course(ui.course.slug);
	else if (view === "missing") {
		const { slug, id } = ui.missing;
		if ((await writtenLessons(slug)).has(id)) await lesson(slug, id);
	} else if (view === "lesson") showChanged();
}
function showChanged() {
	if ($("#changed")) return;
	const bar = document.createElement("div");
	bar.id = "changed";
	bar.className = "changed";
	bar.innerHTML = `<span>The tutor changed this lesson.</span><button type="button" class="btn sm" data-reload-lesson>Show the new version</button>`;
	document.body.appendChild(bar);
}
setInterval(watchTutor, 3500);

document.addEventListener("keydown", (e) => {
	// a course tile is not a button (it holds one): Enter opens it
	if (e.key === "Enter" && e.target.matches?.(".tile[data-course]"))
		return course(e.target.dataset.course);
	if (ui.view !== "review" || e.target.matches("input,textarea")) return;
	if (e.key === " " && !session.shown) {
		e.preventDefault();
		session.shown = true;
		drawReview();
	} else if (session.shown && ["1", "2", "3", "4"].includes(e.key))
		grade(Number(e.key) - 1);
});

if (window.deepbot) {
	deepbot.ready.then(async (init) => {
		ui.p = await loadProgress();
		const a = init.args || {};
		try {
			if (a.course && a.lesson) await lesson(a.course, a.lesson);
			else if (a.course) await course(a.course);
			else if (a.review) {
				ui.courses = await listCourses();
				startReview(typeof a.review === "string" ? a.review : null);
			} else await home();
		} catch (err) {
			root().innerHTML = `<div class="wrap"><b>Could not open that.</b><div class="muted">${esc(err.message)}</div><button type="button" class="btn" style="margin-top:10px" data-home>All courses</button></div>`;
		}
	});
}
