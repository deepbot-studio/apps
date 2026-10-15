/*
 * THE CHAT CARD: a position or a game on a flat board, in the conversation. Step through a game,
 * see the Bot's arrows, then play on from the position right here against the engine (or continue
 * in the Chess app), or open the game in Chess for a review.
 */
import { createBoard2d } from "./lib/board2d.js";
import { moveHint, stateOf } from "./lib/boardview.js";
import { LEVELS, openingName } from "./lib/engine.js";
import { createEngine } from "./lib/engine-client.js";
import { parseSide, runMatch, SPEEDS, sideName } from "./lib/match.js";
import { Game } from "./lib/rules.js";
import { moveSound, play as sound } from "./lib/sound.js";
import { esc, faceSvg, icon } from "./lib/ui.js";

const db = window.deepbot;
let moveHandler = null;
let done = false;
const root = document.getElementById("card");

function fail(message) {
	root.innerHTML = `<p class="card-error">${esc(message)}</p>`;
	db?.fail(message);
}

async function main() {
	if (db) await db.ready;
	const args = db?.args ?? {};
	if (args.white && args.black) return watchHere(args);
	let game;
	try {
		if (args.pgn) game = Game.fromPgn(args.pgn);
		else game = new Game(args.fen || undefined);
	} catch (error) {
		return fail(
			`This ${args.pgn ? "game" : "position"} cannot be shown: ${error.message}`,
		);
	}
	const plies = game.history.length;
	let cur = Number.isInteger(args.ply)
		? Math.max(0, Math.min(plies, args.ply))
		: plies;
	const orientation =
		args.orientation === "black"
			? "b"
			: args.orientation === "white"
				? "w"
				: game.at(cur).turn;
	const h = game.headers ?? {};
	const title =
		args.title ||
		(args.pgn ? `${h.White ?? "White"} vs ${h.Black ?? "Black"}` : "");
	root.innerHTML = `<div class="cb">
		${title ? `<div class="cb-title"><b>${esc(title)}</b>${args.pgn && h.Result ? `<span class="muted small">${esc(h.Result)}</span>` : ""}</div>` : ""}
		<div class="cb-board" data-board></div>
		${plies ? `<div class="cb-nav"><button class="iconbtn" data-nav="first" aria-label="Start">${icon("first")}</button><button class="iconbtn" data-nav="prev" aria-label="Back">${icon("prev")}</button><span class="cb-move" data-move></span><button class="iconbtn" data-nav="next" aria-label="Forward">${icon("next")}</button><button class="iconbtn" data-nav="last" aria-label="End">${icon("last")}</button></div>` : ""}
		${args.note ? `<p class="cb-note">${esc(args.note)}</p>` : ""}
		<div class="cb-actions"><button class="btn sm primary" data-play>${icon("play")}Play from here</button><button class="btn sm" data-continue-app>${icon("knight")}Play in Chess</button>${args.pgn ? `<button class="btn sm" data-review>${icon("chart")}Review in Chess</button>` : ""}</div>
	</div>`;
	const board = createBoard2d(root.querySelector("[data-board]"), {
		orientation,
		onMove: (m) => moveHandler?.(m),
	});
	const show = () => {
		const g = game.at(cur);
		const atStart = cur === (Number.isInteger(args.ply) ? args.ply : plies);
		const arrows = atStart
			? (args.arrows ?? [])
					.filter((a) => /^[a-h][1-8][a-h][1-8]/.test(a))
					.map((a) => ({ from: a.slice(0, 2), to: a.slice(2, 4), kind: "" }))
			: [];
		const marks = atStart
			? Object.fromEntries(
					(args.highlight ?? [])
						.filter((s) => /^[a-h][1-8]$/.test(s))
						.map((s) => [s, "target"]),
				)
			: {};
		board.set({ ...stateOf(g), movable: null, arrows, marks });
		const m = root.querySelector("[data-move]");
		if (m) {
			const mv = game.history[cur - 1];
			const name = openingName(g);
			m.innerHTML = cur
				? `${Math.ceil(cur / 2)}${mv.colour === "w" ? "." : "..."} ${esc(mv.san)}${name && cur <= 16 ? ` <span class="muted small">${esc(name)}</span>` : ""}`
				: `<span class="muted">Start</span>`;
		}
	};
	for (const b of root.querySelectorAll("[data-nav]"))
		b.onclick = () => {
			const t = b.dataset.nav;
			cur = Math.max(
				0,
				Math.min(
					plies,
					t === "first"
						? 0
						: t === "prev"
							? cur - 1
							: t === "next"
								? cur + 1
								: plies,
				),
			);
			show();
		};
	root.querySelector("[data-play]").onclick = () => {
		const g = game.at(cur);
		if (g.over()) return;
		playHere(g.fen());
	};

	/* ---------------------------------------------------------- playing on, right in the chat */
	let engine = null;
	async function playHere(fen) {
		let level = "medium";
		try {
			const saved = await db?.storage.get("settings");
			if (saved?.level && LEVELS[saved.level]) level = saved.level;
		} catch {
			/* the default level */
		}
		engine ??= createEngine();
		const g = new Game(fen);
		const you = g.turn;
		let busy = false;
		board.orient(you);
		const box = root.querySelector(".cb");
		box.querySelector(".cb-nav")?.remove();
		box.querySelector(".cb-note")?.remove();
		const actions = box.querySelector(".cb-actions");
		actions.innerHTML = `<span class="cb-status" data-status></span>
			<div class="cb-levels" role="group" aria-label="Level">${Object.keys(
				LEVELS,
			)
				.map(
					(id) =>
						`<button class="chip" data-level="${id}" aria-pressed="${id === level}">${LEVELS[id].label}</button>`,
				)
				.join("")}</div>
			<button class="btn sm" data-undo>${icon("undo")}Take back</button>
			<button class="btn sm" data-continue>${icon("knight")}Continue in Chess</button>
			<button class="btn sm ghost" data-stop>${icon("x")}Stop</button>`;
		const status = (text) => {
			actions.querySelector("[data-status]").textContent = text;
		};
		const refresh = (move = null) => {
			const over = g.over();
			board.set({
				...stateOf(g, {
					canMove: !busy && !over && g.turn === you ? you : null,
				}),
				arrows: [],
				marks: {},
				move,
			});
			actions.querySelector("[data-undo]").disabled =
				busy || !g.history.some((m) => m.colour === you);
			if (over) {
				const win =
					(over.result === "1-0") === (you === "w") &&
					over.result !== "1/2-1/2";
				status(
					over.result === "1/2-1/2"
						? `Draw: ${over.reason}.`
						: win
							? "Checkmate. You won!"
							: `Checkmate. The engine won.`,
				);
				sound(over.result === "1/2-1/2" ? "draw" : win ? "win" : "lose");
			} else status(busy ? "Thinking…" : g.turn === you ? "Your move." : "");
		};
		async function reply() {
			if (g.over() || g.turn === you) return refresh();
			busy = true;
			refresh();
			const at = g;
			try {
				const r = await engine.move({
					fen,
					moves: g.history.map((m) => m.uci),
					level,
					ms: LEVELS[level].ms,
				});
				if (at !== g) return;
				await new Promise((res) =>
					setTimeout(res, LEVELS[level].ms ? 150 : 500),
				);
				const mv = g.move(r.move);
				busy = false;
				if (mv) sound(moveSound(mv, { check: mv.check }));
				refresh(mv ? moveHint(mv) : null);
			} catch (error) {
				busy = false;
				if (!error?.cancelled) status(error?.message ?? String(error));
				refresh();
			}
		}
		board.onMove = null;
		moveHandler = ({ from, to, dropped }) => {
			if (busy || g.turn !== you || g.over()) return;
			const options = g
				.legalMoves()
				.filter((m) => m.from === from && m.to === to);
			if (!options.length) return refresh();
			// in the card a pawn becomes a queen; the app asks
			const mv = g.move({
				from,
				to,
				promotion: options.some((m) => m.promotion) ? "q" : null,
			});
			if (!mv) return refresh();
			sound(moveSound(mv, { check: mv.check }));
			refresh(moveHint(mv, dropped));
			reply();
		};
		for (const b of actions.querySelectorAll("[data-level]"))
			b.onclick = () => {
				level = b.dataset.level;
				for (const x of actions.querySelectorAll("[data-level]"))
					x.setAttribute("aria-pressed", String(x === b));
			};
		actions.querySelector("[data-undo]").onclick = () => {
			engine.cancel();
			busy = false;
			while (g.history.length && g.history.at(-1).colour !== you) g.undo();
			g.undo();
			refresh();
		};
		actions.querySelector("[data-continue]").onclick = () => {
			engine.cancel();
			db?.openPage("play", { startFen: g.fen(), you });
		};
		actions.querySelector("[data-stop]").onclick = () => {
			engine.cancel();
			moveHandler = null;
			main();
		};
		refresh();
		reply();
	}
	root
		.querySelector("[data-review]")
		?.addEventListener("click", () =>
			db?.openPage("play", { view: "review", pgn: args.pgn }),
		);
	root.querySelector("[data-continue-app]").onclick = () => {
		const g = game.at(cur);
		if (!g.over()) db?.openPage("play", { startFen: g.fen(), you: g.turn });
	};
	document.addEventListener("keydown", (e) => {
		if (e.key === "ArrowLeft") root.querySelector('[data-nav="prev"]')?.click();
		if (e.key === "ArrowRight")
			root.querySelector('[data-nav="next"]')?.click();
	});
	show();
	const over = game.at(cur).over();
	if (over) {
		root.querySelector("[data-play]").disabled = true;
		root.querySelector("[data-continue-app]").disabled = true;
	}
	if (done) return;
	done = true;
	db?.done(
		args.pgn
			? `A game of ${plies} half-moves, on move ${cur}.`
			: "The position is on the board.",
	);
}

/* ---------------------------------------------------------- two players, watched in the chat */
async function watchHere(args) {
	const canThink = Boolean(db?.features?.includes("think"));
	const bots = db?.bots ?? [];
	const white = parseSide(args.white, bots, canThink);
	const black = parseSide(args.black, bots, canThink);
	if (!white || !black) {
		const missing = !white ? args.white : args.black;
		const known = bots.map((b) => b.name).join(", ");
		return fail(
			canThink
				? `There is no Bot called "${missing}". The Bots here: ${known || "none"}; or use "engine" or "engine:hard".`
				: `This DeepBot cannot let a Bot choose chess moves yet (it needs a newer DeepBot). The engine can still play: use "engine:easy" ... "engine:expert".`,
		);
	}
	let fen;
	try {
		fen = args.fen ? new Game(args.fen).fen() : undefined;
	} catch (error) {
		return fail(`This position cannot be played: ${error.message}`);
	}
	const face = (side, mood = "idle") =>
		side.kind === "bot"
			? faceSvg(side.bot, mood)
			: `<span class="engine-face">${icon("knight")}</span>`;
	const player = (colour, side) =>
		`<div class="cb-player" data-player="${colour}"><span class="face" data-face="${colour}">${face(side)}</span><b>${esc(sideName(side))}</b><span class="muted small">${colour === "w" ? "White" : "Black"}</span><span class="cb-say" data-say="${colour}"></span></div>`;
	root.innerHTML = `<div class="cb">
		${args.title ? `<div class="cb-title"><b>${esc(args.title)}</b></div>` : ""}
		${player("b", black)}
		<div class="cb-board" data-board></div>
		${player("w", white)}
		<div class="cb-actions"><span class="cb-status" data-status>Starting…</span>
			<button class="btn sm" data-pause>${icon("pause")}Pause</button>
			<div class="seg" role="group" aria-label="Speed">${Object.keys(SPEEDS)
				.map(
					(sp) =>
						`<button data-speed="${sp}" aria-pressed="${sp === (args.speed ?? "normal")}">${sp[0].toUpperCase()}${sp.slice(1)}</button>`,
				)
				.join("")}</div>
			<button class="btn sm ghost" data-stop>${icon("x")}Stop</button></div>
	</div>`;
	const board = createBoard2d(root.querySelector("[data-board]"), {
		orientation: "w",
	});
	const engine = createEngine();
	const status = (t) => {
		root.querySelector("[data-status]").textContent = t;
	};
	const timers = {};
	const sides = { w: white, b: black };
	const match = runMatch({
		white,
		black,
		startFen: fen,
		engine,
		speed: SPEEDS[args.speed] ? args.speed : "normal",
		onMove: (mv, game) => {
			sound(moveSound(mv, { check: mv.check }));
			board.set({ ...stateOf(game), movable: null, move: moveHint(mv) });
			status(
				`${Math.ceil(game.history.length / 2)}${mv.colour === "w" ? "." : "..."} ${mv.san}`,
			);
		},
		onSay: (colour, text, mood) => {
			const el = root.querySelector(`[data-say="${colour}"]`);
			el.textContent = `“${text}”`;
			root.querySelector(`[data-face="${colour}"]`).innerHTML = face(
				sides[colour],
				mood,
			);
			clearTimeout(timers[colour]);
			timers[colour] = setTimeout(() => {
				el.textContent = "";
				root.querySelector(`[data-face="${colour}"]`).innerHTML = face(
					sides[colour],
				);
			}, 5000);
		},
		onThinking: (colour, on) => {
			if (on) status(`${sideName(sides[colour])} is thinking…`);
		},
		onEnd: (over, game) => {
			const winner =
				over.result === "1-0" ? "w" : over.result === "0-1" ? "b" : null;
			status(
				winner
					? `${sideName(sides[winner])} won: ${over.reason}.`
					: `A draw: ${over.reason}.`,
			);
			sound(winner ? "win" : "draw");
			const pgn = game.pgn({
				headers: {
					Event: "DeepBot Chess (watched)",
					White: sideName(white),
					Black: sideName(black),
					Termination: over.reason,
				},
			});
			const actions = root.querySelector(".cb-actions");
			actions.querySelector("[data-pause]").remove();
			actions.querySelector(".seg").remove();
			actions.querySelector("[data-stop]").remove();
			const review = document.createElement("button");
			review.className = "btn sm primary";
			review.innerHTML = `${icon("chart")}Review in Chess`;
			review.onclick = () => db?.openPage("play", { view: "review", pgn });
			actions.appendChild(review);
			db?.done(
				`The game is over: ${winner ? `${sideName(sides[winner])} won` : "a draw"} (${over.reason}), after ${Math.ceil(game.history.length / 2)} moves.`,
			);
		},
	});
	board.set({ ...stateOf(match.game), movable: null });
	const pause = root.querySelector("[data-pause]");
	pause.onclick = () => {
		if (match.paused) match.resume();
		else match.pause();
		pause.innerHTML = match.paused
			? `${icon("play")}Resume`
			: `${icon("pause")}Pause`;
	};
	for (const b of root.querySelectorAll("[data-speed]"))
		b.onclick = () => {
			match.setSpeed(b.dataset.speed);
			for (const x of root.querySelectorAll("[data-speed]"))
				x.setAttribute("aria-pressed", String(x === b));
		};
	root.querySelector("[data-stop]").onclick = () => {
		match.stop();
		status("Stopped.");
		for (const el of root.querySelectorAll(
			"[data-pause], .cb-actions .seg, [data-stop]",
		))
			el.remove();
	};
	if (!done) {
		done = true;
		db?.done(
			`${sideName(white)} (White) and ${sideName(black)} (Black) are playing on the card; the person is watching.`,
		);
	}
}

main().catch((error) => fail(error?.message ?? String(error)));
