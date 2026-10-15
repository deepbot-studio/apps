/*
 * A GAME TO WATCH: two players that are not you. Each side is the engine at a level, or one of
 * your Bots choosing its own moves through your model (deepbot.think). Used by the app's Watch mode
 * and by the chat card ("let Assistant play Writer").
 *
 *   const match = runMatch({ white, black, engine, onMove, onSay, onEnd, speed });
 *   match.pause(); match.resume(); match.setSpeed("fast"); match.stop();
 *
 * A side is { kind: "engine", level } or { kind: "bot", bot: { id, name, faces } }.
 * A Bot whose answer is not a legal move twice running gets an engine move instead (and says so).
 */
import { LEVELS } from "./engine.js";
import { Game, START } from "./rules.js";

export const SPEEDS = { slow: 2600, normal: 1200, fast: 250 };
const MAX_PLIES = 240;

export const sideName = (side) =>
	side.kind === "bot"
		? side.bot.name
		: `Engine (${LEVELS[side.level]?.label ?? "Medium"})`;

/** "Assistant", "engine", "engine:hard" or a Bot id, as a side; null when no such Bot. */
export function parseSide(text, bots, canThink) {
	const t = String(text ?? "").trim();
	const engine = /^engine(?::(\w+))?$/i.exec(t);
	if (engine)
		return {
			kind: "engine",
			level: LEVELS[engine[1]?.toLowerCase()]
				? engine[1].toLowerCase()
				: "medium",
		};
	if (!canThink) return null;
	const bot =
		bots.find((b) => b.id === t) ??
		bots.find((b) => b.name.toLowerCase() === t.toLowerCase());
	return bot ? { kind: "bot", bot } : null;
}

async function botMove(game, side, other) {
	const colour = game.turn === "w" ? "white" : "black";
	const legal = game.legalMoves().map((m) => m.san);
	const system = `You are ${side.bot.name}, playing chess as ${colour} against ${sideName(other)} in the DeepBot Chess app, while a person watches. Play honest, good chess. Reply with one JSON object and nothing else: {"move": "<exactly one move from the legal list, in SAN>", "say": "<a short remark to your opponent or the audience, at most 12 words, or an empty string>"}`;
	const history = game.pgn().split("\n\n")[1]?.trim() || "(no moves yet)";
	let feedback = "";
	for (let attempt = 0; attempt < 2; attempt++) {
		const prompt = `Moves so far: ${history}\nPosition (FEN): ${game.fen()}\nYou are ${colour}. Legal moves: ${legal.join(", ")}\n${feedback}Your move?`;
		let text;
		try {
			text = await window.deepbot.think(prompt, { system });
		} catch (error) {
			return { error: error?.message ?? String(error) };
		}
		const json = /\{[\s\S]*\}/.exec(text ?? "");
		let move = "";
		let say = "";
		try {
			const data = JSON.parse(json?.[0] ?? "{}");
			move = String(data.move ?? "").trim();
			say = String(data.say ?? "")
				.trim()
				.slice(0, 120);
		} catch {
			move =
				String(text ?? "")
					.trim()
					.split(/\s+/)[0] ?? "";
		}
		const found = game
			.legalMoves()
			.find(
				(m) =>
					m.san === move ||
					m.san.replace(/[+#]/, "") === move.replace(/[+#]/, "") ||
					m.uci === move,
			);
		if (found) return { move: found.uci, say };
		feedback = `Your last answer "${move.slice(0, 20)}" is not one of the legal moves. Choose exactly one from the list.\n`;
	}
	return { error: "no legal move in its answer" };
}

export function runMatch({
	white,
	black,
	startFen = START,
	engine,
	onMove,
	onSay,
	onThinking,
	onEnd,
	speed = "normal",
}) {
	const game = new Game(startFen);
	let paused = false;
	let stopped = false;
	let delay = SPEEDS[speed] ?? SPEEDS.normal;
	let wake = null;
	const sleep = (ms) =>
		new Promise((resolve) => {
			const t = setTimeout(resolve, ms);
			wake = () => {
				clearTimeout(t);
				resolve();
			};
		});
	const waitWhilePaused = async () => {
		while (paused && !stopped) await sleep(200);
	};

	async function loop() {
		await sleep(600);
		while (!stopped) {
			await waitWhilePaused();
			if (stopped) return;
			const over = game.over();
			if (over) return onEnd?.(over, game);
			if (game.history.length >= MAX_PLIES) {
				game.end("1/2-1/2", "the move limit");
				return onEnd?.(game.over(), game);
			}
			const side = game.turn === "w" ? white : black;
			const other = game.turn === "w" ? black : white;
			onThinking?.(game.turn, true);
			const started = performance.now();
			let r;
			if (side.kind === "bot") {
				r = await botMove(game, side, other);
				if (r.error && !stopped) {
					onSay?.(
						game.turn,
						"I got a bit lost there, so the engine moved for me.",
						"confused",
					);
					r = null;
				}
			}
			if (stopped) return;
			if (!r) {
				try {
					const level = side.kind === "engine" ? side.level : "easy";
					r = await engine.move({
						fen: startFen,
						moves: game.history.map((m) => m.uci),
						level,
						ms: LEVELS[level].ms,
					});
				} catch (error) {
					if (error?.cancelled || stopped) return;
					game.end(
						"1/2-1/2",
						`the engine stopped (${error?.message ?? error})`,
					);
					return onEnd?.(game.over(), game);
				}
			}
			onThinking?.(game.turn, false);
			// give the watcher time to follow
			const spent = performance.now() - started;
			if (spent < delay) await sleep(delay - spent);
			await waitWhilePaused();
			if (stopped) return;
			const colour = game.turn;
			const mv = game.move(r.move);
			if (!mv) {
				game.end("1/2-1/2", "a move that did not fit");
				return onEnd?.(game.over(), game);
			}
			onMove?.(mv, game);
			if (r.say) onSay?.(colour, r.say, "playful");
		}
	}
	loop();

	return {
		game,
		pause() {
			paused = true;
		},
		resume() {
			paused = false;
			wake?.();
		},
		get paused() {
			return paused;
		},
		setSpeed(s) {
			delay = SPEEDS[s] ?? delay;
			wake?.();
		},
		stop() {
			stopped = true;
			engine.cancel();
			wake?.();
		},
	};
}
