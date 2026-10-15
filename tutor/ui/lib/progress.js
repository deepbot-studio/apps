/*
 * WHAT THE LEARNER HAS DONE, kept per person in the app's storage (never in the shared workspace):
 * lessons finished and their scores, answers to every exercise, flashcards on a spaced-repetition
 * schedule (SM-2, the Anki/SuperMemo method), points, a day streak and a daily history for the
 * progress page. Pure functions take and return the state; load/save talk to deepbot.storage.
 */

const KEY = "progress";
const DAY = 86400000;

export function emptyProgress() {
	return { v: 1, lessons: {}, cards: {}, days: {}, xp: 0, goal: 20 };
}

export const today = (now = Date.now()) => {
	const d = new Date(now);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function loadProgress() {
	try {
		const v = await deepbot.storage.get(KEY);
		return v && typeof v === "object"
			? { ...emptyProgress(), ...v }
			: emptyProgress();
	} catch {
		return emptyProgress();
	}
}

let saving = Promise.resolve();
export function saveProgress(p) {
	saving = saving.then(() => deepbot.storage.set(KEY, p).catch(() => {}));
	return saving;
}

/** Points for the day (and the streak follows from days with any points). */
export function addXp(p, n, now = Date.now()) {
	const d = today(now);
	p.xp = (p.xp || 0) + n;
	p.days[d] = (p.days[d] || 0) + n;
	return p;
}

export function streak(p, now = Date.now()) {
	let n = 0;
	let t = now;
	// today does not break the streak if nothing has been done yet today
	if (!p.days[today(t)]) t -= DAY;
	while (p.days[today(t)]) {
		n++;
		t -= DAY;
	}
	return n;
}

const lessonKey = (course, lesson) => `${course}/${lesson}`;

export function lessonState(p, course, lesson) {
	return p.lessons[lessonKey(course, lesson)] || null;
}

/** Record one answered item inside a lesson (block index + item index). */
export function recordAnswer(
	p,
	course,
	lesson,
	itemId,
	correct,
	now = Date.now(),
) {
	const k = lessonKey(course, lesson);
	const s = p.lessons[k] || { answers: {}, started: now };
	const prev = s.answers[itemId];
	// the first try counts for the score; later tries only mark it solved
	s.answers[itemId] = prev
		? { ...prev, solved: prev.solved || correct, tries: prev.tries + 1 }
		: { first: correct, solved: correct, tries: 1 };
	s.last = now;
	p.lessons[k] = s;
	const gain = !prev ? (correct ? 10 : 2) : correct && !prev.solved ? 4 : 0;
	if (gain) {
		addXp(p, gain, now);
		s.xp = (s.xp || 0) + gain;
	}
	return s.answers[itemId];
}

/** Score of a lesson: the share of items right the first time. Stars: 1 done, 2 at 70%, 3 at 90%. */
export function lessonScore(state, totalItems) {
	if (!state) return { score: 0, stars: 0, answered: 0 };
	const items = Object.values(state.answers || {});
	const right = items.filter((a) => a.first).length;
	const score = totalItems ? right / totalItems : 1;
	const stars = !state.done ? 0 : score >= 0.9 ? 3 : score >= 0.7 ? 2 : 1;
	return { score, stars, answered: items.length };
}

export function finishLesson(p, course, lesson, totalItems, now = Date.now()) {
	const k = lessonKey(course, lesson);
	const s = p.lessons[k] || { answers: {}, started: now };
	const first = !s.done;
	s.done = s.done || now;
	s.last = now;
	// how many questions the lesson had, so the course's score counts skipped ones as the lesson did
	if (totalItems) s.items = totalItems;
	p.lessons[k] = s;
	if (first) {
		addXp(p, 20, now);
		s.xp = (s.xp || 0) + 20;
	}
	return lessonScore(s, totalItems);
}

/** Forget a course that is deleted: its lessons' answers and its flashcards. */
export function forgetCourse(p, course) {
	for (const k of Object.keys(p.lessons))
		if (k.startsWith(`${course}/`)) delete p.lessons[k];
	for (const [id, c] of Object.entries(p.cards))
		if (c?.course === course) delete p.cards[id];
	return p;
}

/* -------------------------------------------------------------------------- flashcards (SM-2) */

export const cardId = (course, lesson, front) =>
	`${course}/${lesson}/${String(front).slice(0, 80)}`;

/** Put cards into the learner's deck (new cards are due now). */
export function addCards(p, course, lesson, cards, now = Date.now()) {
	let added = 0;
	for (const c of cards) {
		const id = cardId(course, lesson, c.front);
		if (p.cards[id]) continue;
		p.cards[id] = {
			course,
			lesson,
			front: c.front,
			back: c.back,
			ef: 2.5,
			n: 0,
			interval: 0,
			due: now,
		};
		added++;
	}
	return added;
}

/**
 * Grade a review: 0 again, 1 hard, 2 good, 3 easy (the four buttons). SM-2 with the usual tweaks:
 * "again" restarts the card for today, "hard" grows slowly, "easy" jumps.
 */
export function review(card, grade, now = Date.now()) {
	const q = [1, 3, 4, 5][grade] ?? 4;
	const c = { ...card };
	if (grade === 0) {
		c.n = 0;
		c.interval = 0;
		c.due = now + 10 * 60000; // again in ten minutes
	} else if (grade === 1 && c.n === 0) {
		// hard on a new card: once more later today
		c.interval = 0;
		c.due = now + 6 * 3600000;
	} else {
		if (c.n === 0) c.interval = grade === 3 ? 4 : 1;
		else if (c.n === 1) c.interval = grade === 3 ? 8 : grade === 1 ? 3 : 6;
		else
			c.interval = Math.round(
				c.interval * (grade === 1 ? 1.2 : c.ef * (grade === 3 ? 1.3 : 1)),
			);
		c.n += 1;
		c.due = now + c.interval * DAY;
	}
	c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
	c.last = now;
	return c;
}

export function dueCards(p, { course = null, now = Date.now() } = {}) {
	return Object.entries(p.cards)
		.filter(([, c]) => c.due <= now && (!course || c.course === course))
		.map(([id, c]) => ({ id, ...c }))
		.sort((a, b) => a.due - b.due);
}

/** When a card next comes back, in words. */
export function nextIn(card, grade, now = Date.now()) {
	const c = review(card, grade, now);
	const ms = c.due - now;
	if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
	if (ms < DAY) return `${Math.round(ms / 3600000)} h`;
	const d = Math.round(ms / DAY);
	return d < 30
		? `${d} d`
		: d < 365
			? `${Math.round(d / 30)} mo`
			: `${(d / 365).toFixed(1)} y`;
}

/** Mastery of a course: lessons done, average first-try score, cards learned (interval >= 21 days). */
export function courseProgress(p, course) {
	const lessons = (course.units || []).flatMap((u) => u.lessons || []);
	let done = 0;
	let scoreSum = 0;
	let scored = 0;
	for (const l of lessons) {
		const s = lessonState(p, course.slug, l.id);
		if (s?.done) done++;
		const items = Object.values(s?.answers || {});
		if (items.length) {
			const of = Math.max(items.length, s.items || 0);
			scoreSum += items.filter((a) => a.first).length / of;
			scored++;
		}
	}
	const cards = Object.values(p.cards).filter((c) => c.course === course.slug);
	return {
		total: lessons.length,
		done,
		share: lessons.length ? done / lessons.length : 0,
		accuracy: scored ? scoreSum / scored : null,
		cards: cards.length,
		learned: cards.filter((c) => c.interval >= 21).length,
		next: lessons.find((l) => !lessonState(p, course.slug, l.id)?.done) || null,
	};
}
