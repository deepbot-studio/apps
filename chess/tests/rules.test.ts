import { describe, expect, test } from "bun:test";
import { Game, Position, perft, START } from "../ui/lib/rules.js";

const cases: [string, number[]][] = [
	[START, [20, 400, 8902, 197281]],
	[
		"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
		[48, 2039, 97862],
	],
	["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238, 674624]],
	[
		"r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
		[6, 264, 9467, 422333],
	],
	[
		"rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
		[44, 1486, 62379],
	],
	[
		"r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
		[46, 2079, 89890],
	],
];

describe("perft", () => {
	for (const [fen, counts] of cases)
		test(fen, () => {
			const pos = new Position(fen);
			counts.forEach((n, i) => {
				expect(perft(pos, i + 1)).toBe(n);
			});
			expect(pos.fen()).toBe(new Position(fen).fen());
		});
});

describe("Game", () => {
	test("SAN, check, mate", () => {
		const g = new Game();
		for (const s of ["f3", "e5", "g4", "Qh4#"]) expect(g.move(s)?.san).toBe(s);
		expect(g.over()).toEqual({ result: "0-1", reason: "checkmate" });
	});
	test("disambiguation, castling, promotion, en passant", () => {
		const g = new Game("4k3/1P6/8/3pP3/8/8/8/R3K2R w KQ d6 0 1");
		const sans = g.legalMoves().map((m) => m.san);
		expect(sans).toContain("O-O");
		expect(sans).toContain("O-O-O");
		expect(sans).toContain("b8=Q+");
		expect(sans).toContain("exd6");
		expect(g.move({ from: "e5", to: "d6" })?.enPassant).toBe(true);
		expect(g.pieceAt("d5")).toBeNull();
		const g2 = new Game("8/8/8/8/8/8/R6R/4k1K1 w - - 0 1");
		expect(g2.legalMoves().map((m) => m.san)).toContain("Rag2");
	});
	test("stalemate, insufficient material, repetition", () => {
		expect(new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").over()?.reason).toBe(
			"stalemate",
		);
		expect(new Game("8/8/8/4k3/8/8/2B5/4K3 w - - 0 1").over()?.reason).toBe(
			"insufficient material",
		);
		const g = new Game();
		for (const s of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"])
			g.move(s);
		expect(g.over()?.reason).toBe("threefold repetition");
	});
	test("PGN round trip, undo, UCI", () => {
		const g = new Game();
		for (const s of ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "e7e8"].slice(0, 6))
			g.move(s);
		expect(g.move("b5c6")?.san).toBe("Bxc6");
		const back = Game.fromPgn(g.pgn());
		expect(back.fen()).toBe(g.fen());
		expect(
			Game.fromPgn("1. e4 {good} e5 (1... c5 2. Nf3) 2. Nf3 $1 *").history
				.length,
		).toBe(3);
		g.undo();
		expect(g.history.length).toBe(6);
		expect(() => Game.fromPgn("1. e4 e4")).toThrow(/e4/);
	});
	test("bad FEN says why", () => {
		expect(() => new Position("8/8/8 w - - 0 1")).toThrow(/eight ranks/);
		expect(() => new Position("8/8/8/8/8/8/8/8 w - - 0 1")).toThrow(/one king/);
	});
});
