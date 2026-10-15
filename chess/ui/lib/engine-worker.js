/*
 * THE ENGINE'S THREAD: searches here, so the board never freezes while the engine thinks.
 * Messages in: { id, type: "move", fen, moves, level, ms } and { id, type: "analyse", fen, moves, ms, depth }.
 * Messages out: { id, type: "info", ... } while searching, then { id, type: "done", result } or { id, type: "error", message }.
 */
import { chooseMove, Engine, positionFrom, uci } from "./engine.js";

const engine = new Engine(20);

self.onmessage = (event) => {
	const msg = event.data ?? {};
	try {
		const pos = positionFrom(msg.fen, msg.moves ?? []);
		const white = pos.turn === 0;
		const report = (r) => ({
			move: r.move ? uci(r.move) : null,
			// the score from white's side, so a whole game reads the same way
			score: white ? r.score : -r.score,
			depth: r.depth,
			pv: (r.pv ?? []).map(uci),
			book: Boolean(r.book),
			nodes: r.nodes ?? 0,
		});
		if (msg.type === "new") {
			engine.clear();
			self.postMessage({ id: msg.id, type: "done", result: null });
			return;
		}
		const onInfo = (r) =>
			self.postMessage({ id: msg.id, type: "info", info: report(r) });
		const r =
			msg.type === "analyse"
				? engine.search(pos, {
						ms: msg.ms ?? 1000,
						depth: msg.depth ?? 64,
						onInfo,
					})
				: chooseMove(engine, pos, msg.level, { ms: msg.ms, onInfo });
		self.postMessage({ id: msg.id, type: "done", result: report(r) });
	} catch (error) {
		self.postMessage({
			id: msg.id,
			type: "error",
			message: error?.message ?? String(error),
		});
	}
};
