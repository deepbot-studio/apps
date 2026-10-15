import { describe, expect, test } from "bun:test";
import { COURSES } from "../ui/lib/lessons.js";
import { Game, Position } from "../ui/lib/rules.js";

const hasKings = (fen: string) =>
	/k/.test(fen.split(" ")[0]) && /K/.test(fen.split(" ")[0]);

describe("lessons", () => {
	const ids = new Set<string>();
	for (const course of COURSES)
		for (const lesson of course.lessons)
			test(`${course.id}/${lesson.id}`, () => {
				const key = `${course.id}/${lesson.id}`;
				expect(ids.has(key)).toBe(false);
				ids.add(key);
				expect(lesson.steps.length).toBeGreaterThan(0);
				// biome-ignore lint/suspicious/noExplicitAny: lesson steps are plain data of several shapes
				for (const step of lesson.steps as any[]) {
					const t = step.task;
					if (step.fen && hasKings(step.fen)) new Position(step.fen); // throws when illegal
					if (!t) {
						expect(step.fen).toBeTruthy();
						continue;
					}
					if (["move", "check", "mate", "best", "play"].includes(t.type)) {
						expect(hasKings(step.fen)).toBe(true);
						const g = new Game(step.fen);
						if (t.type === "move")
							for (const m of t.moves)
								expect(new Game(step.fen).move(m)).toBeTruthy();
						if (t.type === "mate") {
							const mates = g.legalMoves().filter((m) => {
								const x = new Game(step.fen);
								x.move(m.uci);
								return x.over()?.reason === "checkmate";
							});
							expect(mates.length).toBeGreaterThan(0);
						}
						if (t.type === "check")
							expect(g.legalMoves().some((m) => m.san.endsWith("+"))).toBe(
								true,
							);
					}
					if (t.type === "line") {
						const g = new Game(step.fen);
						for (const m of t.moves)
							expect(g.move(m)?.san.replace(/[+#]/, "")).toBe(
								m.replace(/[+#]/, ""),
							);
					}
					if (t.type === "quiz") expect(t.options[t.answer]).toBeTruthy();
					if (t.type === "sandbox") {
						expect(t.stars.length).toBeGreaterThan(0);
						for (const s of [...t.stars, t.from, ...(t.own ?? [])])
							expect(/^[a-h][1-8]$/.test(s)).toBe(true);
					}
				}
			});
	test("display positions that show a mate or stalemate are what they say", () => {
		const mate = [
			"R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1",
			"6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1",
			"7k/7R/5N2/8/8/8/8/6K1 b - - 0 1",
			"5r2/4Nppk/8/8/8/8/8/6KR b - - 0 1",
			"2kr4/3p4/B7/8/5B2/8/8/6K1 b - - 0 1",
			"r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
		];
		for (const fen of mate)
			expect(new Game(fen).over()?.reason).toBe("checkmate");
		expect(new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").over()?.reason).toBe(
			"stalemate",
		);
	});
});
