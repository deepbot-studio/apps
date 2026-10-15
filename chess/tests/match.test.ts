import { expect, test } from "bun:test";
import { chooseMove, Engine, positionFrom, uci } from "../ui/lib/engine.js";
import { parseSide, runMatch } from "../ui/lib/match.js";

const bots = [
	{ id: "b1", name: "Assistant", faces: {} },
	{ id: "b2", name: "Writer", faces: {} },
];

test("sides from words", () => {
	expect(parseSide("engine", bots, true)).toEqual({
		kind: "engine",
		level: "medium",
	});
	expect(parseSide("Engine:Expert", bots, true)).toEqual({
		kind: "engine",
		level: "expert",
	});
	expect(parseSide("writer", bots, true)?.bot.id).toBe("b2");
	expect(parseSide("b1", bots, true)?.bot.name).toBe("Assistant");
	expect(parseSide("Nobody", bots, true)).toBeNull();
	// without deepbot.think a Bot cannot play
	expect(parseSide("Writer", bots, false)).toBeNull();
});

test("two engines play a game to the end", async () => {
	const e = new Engine(16);
	const engine = {
		move: async ({ fen, moves, level }) => {
			const pos = positionFrom(
				fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
				moves,
			);
			return { move: uci(chooseMove(e, pos, level, { ms: 40 }).move) };
		},
		cancel() {},
	};
	const over = await new Promise((resolve) => {
		const m = runMatch({
			white: { kind: "engine", level: "medium" },
			black: { kind: "engine", level: "beginner" },
			engine,
			speed: "fast",
			onEnd: (o) => resolve(o),
		});
		m.setSpeed("fast");
	});
	expect(["1-0", "0-1", "1/2-1/2"]).toContain(over.result);
}, 120000);
