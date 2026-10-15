import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const { evaluate, equivalent, checkAnswer, hasForm, namesIn } = await import(
	"../ui/lib/expr.js"
);
const P = await import("../ui/lib/progress.js");
const C = await import("../ui/lib/course.js");

const DAY = 86400000;
const fx = (p: string) =>
	JSON.parse(
		readFileSync(
			new URL(`./fixtures/quadratics/${p}`, import.meta.url),
			"utf8",
		),
	);

describe("maths as typed", () => {
	test("evaluates what people type", () => {
		expect(evaluate("2^10")).toBe(1024);
		expect(evaluate("2x+1", { x: 3 })).toBe(7);
		expect(evaluate("√16")).toBe(4);
		expect(evaluate("5!")).toBe(120);
		expect(evaluate("1,5*2")).toBe(3);
		expect(evaluate("|−3|+2")).toBe(5);
		expect(evaluate("x²", { x: 4 })).toBe(16);
		expect(evaluate("(-8)^(1/3)")).toBeCloseTo(-2);
		expect(evaluate("-2^2")).toBe(-4);
		expect(evaluate("max(2,3)")).toBe(3);
		expect(evaluate("2π")).toBeCloseTo(2 * Math.PI);
	});
	test("equivalence", () => {
		expect(equivalent("(x+1)(x-1)", "x^2-1")).toBe(true);
		expect(equivalent("2(x+1)", "2x+1")).toBe(false);
		expect(equivalent("sin^2 x + cos^2 x", "1")).toBe(true);
		expect(equivalent("sqrt(x)/x", "1/sqrt(x)")).toBe(true);
	});
	test("answers", () => {
		expect(checkAnswer("0,5", "1/2")).toBe(true);
		expect(checkAnswer("3.14", "pi", { tolerance: "1%" })).toBe(true);
		expect(checkAnswer("3", "pi", { tolerance: "1%" })).toBe(false);
		expect(checkAnswer("y = 2x+2", "2(x+1)", { kind: "expr" })).toBe(true);
		expect(checkAnswer("Djordje", "Đorđe", { kind: "text" })).toBe(true);
		expect(checkAnswer([2, 0], [0, 2], { kind: "choice" })).toBe(true);
		expect(checkAnswer("", 1)).toBe(false);
	});
	test("forms", () => {
		expect(hasForm("(x-1)(x-3)", "factored")).toBe(true);
		expect(hasForm("x^2-4x+3", "factored")).toBe(false);
		expect(hasForm("2(x+1)^2", "factored")).toBe(true);
		expect(hasForm("x^2-4x+3", "expanded")).toBe(true);
		expect(hasForm("(x-1)(x-3)", "expanded")).toBe(false);
		expect(
			checkAnswer("x^2-4x+3", "(x-1)(x-3)", { kind: "expr", form: "factored" }),
		).toBe(false);
		expect(
			checkAnswer("(x-3)(x-1)", "(x-1)(x-3)", {
				kind: "expr",
				form: "factored",
			}),
		).toBe(true);
	});
	test("names for sliders", () => {
		expect(namesIn("a*sin(b*x)+c").sort()).toEqual(["a", "b", "c", "x"]);
	});
});

describe("progress", () => {
	test("first try counts, points and stars", () => {
		const p = P.emptyProgress();
		const t = Date.UTC(2026, 9, 9, 10);
		P.recordAnswer(p, "c", "l", "q1", true, t);
		P.recordAnswer(p, "c", "l", "q2", false, t);
		P.recordAnswer(p, "c", "l", "q2", true, t);
		expect(p.xp).toBe(16);
		const sc = P.finishLesson(p, "c", "l", 2, t);
		expect(sc.score).toBe(0.5);
		expect(sc.stars).toBe(1);
		expect(P.lessonState(p, "c", "l").xp).toBe(36);
	});
	test("streak", () => {
		const p = P.emptyProgress();
		const now = Date.UTC(2026, 9, 9, 12);
		for (const d of [1, 2, 3]) P.addXp(p, 5, now - d * DAY);
		expect(P.streak(p, now)).toBe(3);
		P.addXp(p, 5, now);
		expect(P.streak(p, now)).toBe(4);
	});
	test("spaced repetition", () => {
		const now = Date.UTC(2026, 9, 9);
		let c = { ef: 2.5, n: 0, interval: 0, due: now };
		expect(P.review(c, 0, now).due - now).toBe(10 * 60000);
		expect(P.review(c, 1, now).due - now).toBe(6 * 3600000);
		c = P.review(c, 2, now);
		expect(c.interval).toBe(1);
		c = P.review(c, 2, now);
		expect(c.interval).toBe(6);
		c = P.review(c, 2, now);
		expect(c.interval).toBeGreaterThan(12);
		expect(P.review(c, 3, now).interval).toBeGreaterThan(c.interval);
	});
	test("cards and due", () => {
		const p = P.emptyProgress();
		expect(P.addCards(p, "c", "l", [{ front: "a", back: "b" }], 0)).toBe(1);
		expect(P.addCards(p, "c", "l", [{ front: "a", back: "b" }], 0)).toBe(0);
		expect(P.dueCards(p, { now: 1 }).length).toBe(1);
	});
});

describe("courses", () => {
	test("the sample course reads and its lessons are valid", () => {
		const c = C.normaliseCourse(fx("course.json"), "quadratics");
		expect(c.slug).toBe("quadratics");
		expect(C.lessonsOf(c).length).toBe(6);
		const l = C.normaliseLesson(
			fx("lessons/meet-the-parabola.json"),
			"meet-the-parabola",
		);
		expect(C.itemsIn(l)).toBe(8);
		expect(C.lessonProblems(l, { projectile: {} })).toEqual([]);
	});
	test("problems are found", () => {
		const l = C.normaliseLesson({
			blocks: [
				{
					type: "quiz",
					questions: [
						{ kind: "choice", prompt: "?", options: ["a"], answer: 3 },
						{ kind: "blank", text: "no gap" },
					],
				},
				{ type: "sim", sim: "nope" },
			],
		});
		expect(C.lessonProblems(l, { projectile: {} }).length).toBe(3);
	});
	test("children get a bright colour, subjects their own", () => {
		expect(C.normaliseCourse({ title: "x", audience: "kids" }).colour).not.toBe(
			"#4F46E5",
		);
		expect(C.normaliseCourse({ title: "x", subject: "History" }).colour).toBe(
			"#B45309",
		);
	});
});

describe("one score, the same on the lesson and the course", () => {
	test("questions skipped in a lesson count against the course score as they did against the lesson", async () => {
		const P = await import("../ui/lib/progress.js");
		const p = P.emptyProgress();
		P.recordAnswer(p, "c", "l1", "q1", true);
		P.recordAnswer(p, "c", "l1", "q2", false);
		const sc = P.finishLesson(p, "c", "l1", 4);
		const cp = P.courseProgress(p, {
			slug: "c",
			units: [{ lessons: [{ id: "l1" }, { id: "l2" }] }],
		});
		expect(sc.score).toBe(0.25);
		expect(cp.accuracy).toBe(0.25);
	});
});
