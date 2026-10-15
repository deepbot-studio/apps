/*
 * PUZZLES: positions from real games where one side has a winning idea, from the Lichess puzzle
 * database (public domain, CC0), a few thousand picked for quality and spread over every level and
 * theme. A rating that follows you (a solved puzzle raises it, a missed one lowers it), puzzles by
 * theme (forks, pins, mates in two, endgames...), hints, the solution, and the Bot to explain one.
 */
import { moveHint, stateOf } from "./boardview.js";
import { Game } from "./rules.js";
import { moveSound, play } from "./sound.js";
import { esc, icon, sleep, toast } from "./ui.js";

export const THEMES = {
	mateIn1: ["Mate in 1", "Checkmate in a single move."],
	mateIn2: ["Mate in 2", "Two moves to checkmate."],
	mateIn3: ["Mate in 3", "Three moves to checkmate."],
	fork: ["Fork", "One piece attacks two at once."],
	pin: ["Pin", "A piece cannot move without exposing a bigger one."],
	skewer: ["Skewer", "Attack a big piece; take what stands behind it."],
	discoveredAttack: ["Discovered attack", "Move one piece to unleash another."],
	doubleCheck: ["Double check", "Check from two pieces at once."],
	hangingPiece: ["Hanging piece", "Something is left undefended."],
	trappedPiece: ["Trapped piece", "A piece with nowhere to go."],
	sacrifice: ["Sacrifice", "Give material to get more."],
	deflection: ["Deflection", "Lure a defender away from its job."],
	attraction: ["Attraction", "Draw a piece onto a fatal square."],
	capturingDefender: [
		"Remove the defender",
		"Take the piece that holds it all together.",
	],
	backRankMate: ["Back-rank mate", "The king is stuck behind its own pawns."],
	smotheredMate: [
		"Smothered mate",
		"A knight mates a king boxed in by its own pieces.",
	],
	promotion: ["Promotion", "A pawn reaches the last rank."],
	advancedPawn: [
		"Advanced pawn",
		"A pawn close to promoting decides the game.",
	],
	quietMove: ["Quiet move", "No check, no capture: just the right move."],
	defensiveMove: ["Defence", "Find the move that holds."],
	zugzwang: ["Zugzwang", "Any move makes it worse for them."],
	intermezzo: ["In-between move", "A surprise move before the expected one."],
	xRayAttack: ["X-ray", "An attack through another piece."],
	clearance: ["Clearance", "Clear a square or a line for another piece."],
	interference: ["Interference", "Cut the line between two defenders."],
	exposedKing: ["Exposed king", "A king with no shelter."],
	kingsideAttack: ["Kingside attack", "Break through to the castled king."],
	endgame: ["Endgame", "Few pieces left: technique decides."],
	pawnEndgame: ["Pawn endgame", "Kings and pawns only."],
	rookEndgame: ["Rook endgame", "The most common endgame of all."],
	opening: ["Opening tricks", "Traps in the first moves."],
	enPassant: ["En passant", "The special pawn capture."],
	castling: ["Castling", "The king's move, as a tactic."],
	underPromotion: [
		"Underpromotion",
		"Promote to something other than a queen.",
	],
	anastasiaMate: [
		"Anastasia's mate",
		"Knight and rook trap the king on the edge.",
	],
	arabianMate: ["Arabian mate", "Knight and rook in the corner."],
	bodenMate: ["Boden's mate", "Two bishops on crossing diagonals."],
	dovetailMate: [
		"Dovetail mate",
		"The queen mates, the king's own pieces block it in.",
	],
	hookMate: ["Hook mate", "Rook, knight and pawn hook the king."],
};

let cache = null;
export async function loadPuzzles() {
	if (cache) return cache;
	const res = await fetch(new URL("../data/puzzles.json", import.meta.url));
	if (!res.ok) throw new Error("The puzzles could not be loaded.");
	const rows = await res.json();
	cache = rows.map(([id, fen, moves, rating, themes]) => ({
		id,
		fen,
		moves: moves.split(" "),
		rating,
		themes: themes ? themes.split(" ") : [],
	}));
	return cache;
}

/** Choose a puzzle near a rating, not yet solved, optionally of a theme. */
export function pickPuzzle(
	all,
	{ rating, theme = null, solved = {}, near = 120, exclude = null },
) {
	let pool = all.filter(
		(p) =>
			(!theme || p.themes.includes(theme)) && !solved[p.id] && p.id !== exclude,
	);
	if (!pool.length)
		pool = all.filter((p) => !theme || p.themes.includes(theme));
	for (let w = near; w < 3000; w *= 1.6) {
		const close = pool.filter((p) => Math.abs(p.rating - rating) <= w);
		if (close.length >= 3 || w * 1.6 >= 3000) {
			const list = close.length ? close : pool;
			return list[Math.floor(Math.random() * list.length)];
		}
	}
	return pool[0];
}

export function expected(r, opp) {
	return 1 / (1 + 10 ** ((opp - r) / 400));
}

/**
 * Run one puzzle on a board. The opponent's first move is played, then the person finds the rest;
 * the opponent answers each right move. Resolves when solved or given up: { solved, firstTry }.
 * `onState` hears "your-move", "wrong", "right", "solved", "failed".
 */
export function runPuzzle(board, puzzle, { onState, you: forced } = {}) {
	const game = new Game(puzzle.fen);
	let step = 0; // index into puzzle.moves of the next move to be played
	let mistakes = 0;
	let finished = false;
	let resolveDone;
	const done = new Promise((r) => {
		resolveDone = r;
	});
	const you = forced ?? (game.turn === "w" ? "b" : "w");
	board.orient(you);

	const movable = () => (!finished && game.turn === you ? you : null);
	const show = (move = null, extra = {}) =>
		board.set({ ...stateOf(game, { canMove: movable() }), move, ...extra });

	async function opponent() {
		const u = puzzle.moves[step];
		if (!u) return;
		await sleep(step === 0 ? 650 : 420);
		const mv = game.move(u);
		step++;
		play(moveSound(mv, { check: mv.check }));
		await show(moveHint(mv));
		onState?.("your-move", { game });
	}

	async function onMove({ from, to, dropped }, promotionChooser) {
		if (finished || game.turn !== you) return;
		const options = game
			.legalMoves()
			.filter((m) => m.from === from && m.to === to);
		if (!options.length) return show();
		let promotion = null;
		if (options.some((m) => m.promotion)) {
			promotion = (await promotionChooser?.(to)) ?? "q";
		}
		const expectedMove = puzzle.moves[step];
		const tryMove = game.move({ from, to, promotion });
		if (!tryMove) return show();
		const last = step === puzzle.moves.length - 1;
		// on the last move any checkmate counts, as in the puzzle database's own rules
		const right =
			tryMove.uci === expectedMove ||
			(last && game.over()?.reason === "checkmate");
		if (!right) {
			game.undo();
			mistakes++;
			play("wrong");
			await show(null, { marks: { [to]: "bad" } });
			onState?.("wrong", { game, mistakes });
			setTimeout(() => !finished && show(), 700);
			return;
		}
		step++;
		play(moveSound(tryMove, { check: tryMove.check }));
		await show(moveHint(tryMove, dropped), { marks: { [to]: "good" } });
		if (step >= puzzle.moves.length) {
			finished = true;
			play("correct");
			await show(null, { marks: { [to]: "good" } });
			onState?.("solved", { game, mistakes });
			resolveDone({ solved: true, firstTry: mistakes === 0 });
			return;
		}
		onState?.("right", { game });
		await opponent();
	}

	/** Play the rest of the solution on the board. */
	async function reveal() {
		if (finished) return;
		finished = true;
		await show();
		while (step < puzzle.moves.length) {
			await sleep(550);
			const mv = game.move(puzzle.moves[step]);
			step++;
			if (!mv) break;
			play(moveSound(mv, { check: mv.check }));
			await show(moveHint(mv));
		}
		onState?.("failed", { game });
		resolveDone({ solved: false, firstTry: false });
	}

	/** The next move of the solution, as a hint: first the piece, then the arrow. */
	function hint(level) {
		const u = puzzle.moves[step];
		if (!u || finished) return;
		if (level === 1) board.set({ marks: { [u.slice(0, 2)]: "hint" } });
		else
			board.set({
				marks: { [u.slice(0, 2)]: "hint" },
				arrows: [{ from: u.slice(0, 2), to: u.slice(2, 4), kind: "hint" }],
			});
	}

	show().then(opponent);
	return {
		onMove,
		reveal,
		hint,
		done,
		game,
		you,
		get finished() {
			return finished;
		},
		get mistakes() {
			return mistakes;
		},
	};
}

export async function mountPuzzles(app, el, params = {}) {
	el.innerHTML = `<div class="play"><div class="stage"><div class="stage-tools"><button class="iconbtn" data-flip title="Turn the board" aria-label="Turn the board">${icon("flip")}</button></div></div><aside class="side"><div class="setup"><p class="muted">Loading puzzles…</p></div></aside></div>`;
	const stage = el.querySelector(".stage");
	const side = el.querySelector(".side");
	let alive = true;
	let run = null;
	let all;
	try {
		all = await loadPuzzles();
	} catch (error) {
		side.innerHTML = `<div class="setup"><h2>Puzzles</h2><p class="lead">${esc(error.message)}</p></div>`;
		return {};
	}
	const P = app.progress.puzzle;
	let theme = params.theme && THEMES[params.theme] ? params.theme : null;
	let current = null;
	let hintLevel = 0;
	let chooser = null;
	const board = await app.board(stage, {
		tray: false,
		onMove: (m) => run?.onMove(m, chooser),
	});
	if (!alive) return {};
	el.querySelector("[data-flip]").onclick = () => board.flip();

	// the promotion choice, from play.js's look
	chooser = (square) =>
		new Promise((resolve) => {
			const r = board.rectOf(square);
			const div = document.createElement("div");
			div.className = "promo";
			const colour = run?.you ?? "w";
			import("./pieces.js").then(({ pieceSvg }) => {
				div.innerHTML = ["q", "r", "b", "n"]
					.map((t) => `<button data-p="${t}">${pieceSvg(t, colour)}</button>`)
					.join("");
				document.body.appendChild(div);
				div.style.left = `${Math.max(8, r.left + r.width / 2 - div.offsetWidth / 2)}px`;
				div.style.top = `${Math.max(8, r.top - 70)}px`;
				for (const b of div.querySelectorAll("button"))
					b.onclick = () => {
						div.remove();
						resolve(b.dataset.p);
					};
			});
		});

	function themeChips() {
		const counts = {};
		for (const p of all)
			for (const t of p.themes) if (THEMES[t]) counts[t] = (counts[t] ?? 0) + 1;
		return `<div class="chips themes"><button class="chip" data-theme="" aria-pressed="${!theme}">Any theme</button>${Object.keys(
			THEMES,
		)
			.filter((t) => counts[t])
			.map(
				(t) =>
					`<button class="chip" data-theme="${t}" aria-pressed="${theme === t}" title="${esc(THEMES[t][1])}">${esc(THEMES[t][0])}</button>`,
			)
			.join("")}</div>`;
	}

	function panel(status = "") {
		const t = theme ? THEMES[theme] : null;
		side.innerHTML = `<div class="setup pz">
			<div class="pz-head"><div><h2>Puzzles</h2><p class="lead">${t ? esc(t[1]) : "Find the best move. Then the next one."}</p></div>
				<div class="pz-rating"><b>${Math.round(P.rating)}</b><span class="muted small">your rating</span></div></div>
			<div class="pz-stats"><span>${icon("bolt")}Streak <b>${P.streak}</b></span><span>${icon("trophy")}Best <b>${P.best}</b></span><span>${icon("check")}Solved <b>${Object.keys(P.solved).length}</b></span></div>
			<div class="pz-status" data-status>${status}</div>
			<div class="row pz-actions" data-actions></div>
			<details class="pz-themes" ${theme ? "open" : ""}><summary>Puzzles by theme</summary>${themeChips()}</details>
		</div>`;
		for (const b of side.querySelectorAll("[data-theme]"))
			b.onclick = () => {
				theme = b.dataset.theme || null;
				next();
			};
	}

	function status(html) {
		const s = side.querySelector("[data-status]");
		if (s) s.innerHTML = html;
	}
	function actions(html, wire) {
		const a = side.querySelector("[data-actions]");
		if (!a) return;
		a.innerHTML = html;
		wire?.(a);
	}

	async function next() {
		app.engine.cancel();
		current = pickPuzzle(all, {
			rating: P.rating,
			theme,
			solved: P.solved,
			exclude: current?.id,
		});
		hintLevel = 0;
		panel();
		const colourName = () => (run?.you === "w" ? "White" : "Black");
		run = runPuzzle(board, current, {
			onState: (state, info) => {
				if (!alive) return;
				if (state === "your-move")
					status(
						`<p class="pz-turn"><span class="sw ${run.you}"></span><b>${colourName()} to move.</b> Find the best move.</p>`,
					);
				else if (state === "wrong")
					status(
						`<p class="pz-turn bad"><b>Not this one.</b> Try again${info.mistakes > 1 ? ", or ask for a hint" : ""}.</p>`,
					);
				else if (state === "right")
					status(`<p class="pz-turn good"><b>Yes!</b> Keep going.</p>`);
			},
		});
		actions(
			`<button class="btn" data-hint>${icon("hint")}Hint</button><button class="btn" data-solution>${icon("view")}Show the solution</button><button class="btn ghost" data-skip>Skip</button>`,
			(a) => {
				a.querySelector("[data-hint]").onclick = () => {
					hintLevel = Math.min(2, hintLevel + 1);
					run.hint(hintLevel);
				};
				a.querySelector("[data-solution]").onclick = () => run.reveal();
				a.querySelector("[data-skip]").onclick = () => next();
			},
		);
		const thisRun = run;
		const result = await run.done;
		if (!alive || thisRun !== run) return;
		finish(result);
	}

	function finish({ solved, firstTry }) {
		const before = P.rating;
		const clean = solved && firstTry && hintLevel === 0;
		const score = clean ? 1 : 0;
		const k = P.played < 20 ? 48 : 28;
		P.rating = Math.max(
			400,
			P.rating + k * (score - expected(P.rating, current.rating)),
		);
		P.played++;
		if (clean) {
			P.streak++;
			P.best = Math.max(P.best, P.streak);
		} else P.streak = 0;
		if (solved) P.solved[current.id] = Date.now();
		app.saveProgress();
		const change = Math.round(P.rating - before);
		const themes = current.themes
			.filter((t) => THEMES[t])
			.map((t) => THEMES[t][0]);
		panel(
			`<p class="pz-turn ${clean ? "good" : solved ? "" : "bad"}"><b>${clean ? "Solved!" : solved ? "Solved, with help." : "The solution is on the board."}</b> Rating ${change >= 0 ? "+" : ""}${change}.</p>
			<p class="muted small">Puzzle rated ${current.rating}${themes.length ? `. Themes: ${esc(themes.join(", "))}` : ""}.</p>`,
		);
		actions(
			`<button class="btn primary" data-next>${icon("next")}Next puzzle</button><button class="btn" data-explain>${icon("ask")}Explain with ${esc(app.bot().name)}</button><button class="btn ghost" data-again>Try it again</button>`,
			(a) => {
				a.querySelector("[data-next]").onclick = next;
				a.querySelector("[data-explain]").onclick = explain;
				a.querySelector("[data-again]").onclick = () => {
					const keep = current;
					hintLevel = 0;
					panel();
					run = runPuzzle(board, keep, {
						onState: (state) => {
							if (state === "your-move")
								status(`<p class="pz-turn"><b>Your move.</b></p>`);
							else if (state === "wrong")
								status(`<p class="pz-turn bad"><b>Not this one.</b></p>`);
							else if (state === "solved")
								status(`<p class="pz-turn good"><b>That's it.</b></p>`);
						},
					});
					actions(
						`<button class="btn primary" data-next>${icon("next")}Next puzzle</button>`,
						(b) => {
							b.querySelector("[data-next]").onclick = next;
						},
					);
				};
			},
		);
	}

	function explain() {
		const g = new Game(current.fen);
		const first = g.move(current.moves[0]);
		const start = g.fen();
		const sans = [];
		for (const u of current.moves.slice(1)) {
			const mv = g.move(u);
			if (mv) sans.push(mv.san);
		}
		const themes = current.themes
			.filter((t) => THEMES[t])
			.map((t) => THEMES[t][0]);
		const context = [
			"The person is solving chess puzzles in the Chess app, open beside this conversation.",
			`Puzzle position (FEN), after the opponent's move ${first?.san ?? ""}: ${start}`,
			`The solution: ${sans.join(" ")}`,
			themes.length ? `Themes: ${themes.join(", ")}.` : "",
			"Explain the idea of the solution in plain words, like a friendly coach: what the first move threatens, why the obvious alternatives fail. Moves in SAN, short.",
		]
			.filter(Boolean)
			.join("\n");
		app.ask("Can you explain this puzzle's solution?", context);
	}

	next();
	return {
		destroy() {
			alive = false;
			board.destroy();
		},
	};
}

export { toast };
