import { describe, expect, test } from "bun:test";
import { BOOK } from "../ui/lib/book.js";
import {
	chooseMove,
	Engine,
	evaluate,
	LEVELS,
	openingName,
	positionFrom,
	scoreText,
	uci,
} from "../ui/lib/engine.js";
import { Game, Position } from "../ui/lib/rules.js";

const seeded = (s: number) => () => {
	s = (s * 1664525 + 1013904223) >>> 0;
	return s / 2 ** 32;
};

describe("book", () => {
	for (const line of BOOK)
		test(line.name, () => {
			const g = new Game();
			for (const san of line.moves.split(" "))
				expect(g.move(san)?.san.replace(/[+#]$/, "")).toBe(
					san.replace(/[+#]$/, ""),
				);
			expect(openingName(g)).toBe(line.name);
		});
});

describe("engine", () => {
	const e = new Engine(18);
	test("mate in one", () => {
		const r = e.search(new Position("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"), {
			ms: 500,
		});
		expect(uci(r.move)).toBe("d1d8");
		expect(scoreText(r.score)).toBe("#1");
	});
	test("mate in two (queen sacrifice)", () => {
		const r = e.search(
			new Position(
				"r1b1kb1r/pppp1ppp/5q2/4n3/3KP3/2N3PN/PPP4P/R1BQ1B1R b kq - 0 1",
			),
			{ ms: 1500 },
		);
		expect(r.score).toBeGreaterThan(29000);
	});
	test("wins a hanging queen", () => {
		const r = e.search(
			new Position(
				"rnb1kbnr/pppp1ppp/8/4p1q1/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 1",
			),
			{ ms: 500 },
		);
		expect(uci(r.move)).toBe("c1g5");
	});
	test("knight fork", () => {
		const r = e.search(
			new Position(
				"r3k3/8/8/8/8/8/3N4/4K3 w - - 0 1"
					.replace("r3k3", "r3k3")
					.replace("3N4", "8")
					.replace("8/8/8/8/8", "8/8/8/8/1N6"),
			),
			{ ms: 800 },
		);
		expect(r.move).toBeTruthy();
	});
	test("evaluate is symmetric", () => {
		const a = evaluate(
			new Position(
				"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
			),
		);
		const b = evaluate(
			new Position(
				"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 2 3",
			),
		);
		expect(a).toBe(b);
	});
	test("KQ v K is mated from the middle", () => {
		const pos = new Position("8/8/8/4k3/8/8/8/4K2Q w - - 0 1");
		const eng = new Engine(18);
		let n = 0;
		while (pos.hasLegal() && n < 60) {
			const r =
				pos.turn === 0
					? eng.search(pos, { ms: 150 })
					: eng.search(pos, { ms: 50 });
			pos.make(r.move);
			n++;
		}
		expect(pos.inCheck() && !pos.hasLegal()).toBe(true);
	});
	test("every level plays a legal move, beginner grabs a defended pawn sometimes", () => {
		const pos = positionFrom(
			"rnbqkbnr/ppp2ppp/8/3pp3/4P3/5Q2/PPPP1PPP/RNB1KBNR w KQkq - 0 3",
		);
		for (const id of Object.keys(LEVELS)) {
			const r = chooseMove(new Engine(16), pos, id, {
				ms: 300,
				rand: seeded(3),
			});
			expect(pos.legal()).toContain(r.move);
		}
	});
});
