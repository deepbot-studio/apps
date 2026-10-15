/*
 * LEARN: the courses (lessons.js) and the lesson runner. A lesson is a run of steps on a board:
 * read, then do (move a piece around the stars, find the move, play the opening, mate the king,
 * solve the puzzles). Progress is kept per lesson; the Bot can be asked about any step.
 */
import { moveHint, stateOf } from "./boardview.js";
import { LEVELS } from "./engine.js";
import { COURSES, findLesson, lessonKey } from "./lessons.js";
import { pieceSvg } from "./pieces.js";
import { loadPuzzles, pickPuzzle, runPuzzle } from "./puzzles.js";
import { Game } from "./rules.js";
import { moveSound, play } from "./sound.js";
import { esc, icon, sleep, toast } from "./ui.js";

const FILES = "abcdefgh";

/** Pieces on a board from a FEN, without requiring a legal position (lessons show empty boards). */
export function piecesFromFen(fen) {
	const out = {};
	const rows = String(fen).split(" ")[0].split("/");
	rows.forEach((row, i) => {
		let f = 0;
		for (const ch of row) {
			if (/\d/.test(ch)) f += Number(ch);
			else {
				out[FILES[f] + (8 - i)] =
					(ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase();
				f++;
			}
		}
	});
	return out;
}

function rich(text) {
	return esc(text)
		.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
		.replace(/\*(.+?)\*/g, "<i>$1</i>");
}

const arrowsOf = (list) =>
	(list ?? []).map((a) => ({
		from: a.slice(0, 2),
		to: a.slice(2, 4),
		kind: "alt",
	}));

/** Where one piece may go on a board of stars and blockers (no kings, no checks). */
export function sandboxDests(piece, from, pieces) {
	const f0 = FILES.indexOf(from[0]);
	const r0 = Number(from[1]) - 1;
	const at = (f, r) =>
		f < 0 || f > 7 || r < 0 || r > 7
			? undefined
			: (pieces[FILES[f] + (r + 1)] ?? null);
	const out = [];
	const add = (f, r) => out.push(FILES[f] + (r + 1));
	const type = piece[1];
	const enemy = (p) => p && p[0] !== piece[0];
	if (type === "p") {
		const dir = piece[0] === "w" ? 1 : -1;
		if (at(f0, r0 + dir) === null) {
			add(f0, r0 + dir);
			const start = piece[0] === "w" ? 1 : 6;
			if (r0 === start && at(f0, r0 + 2 * dir) === null) add(f0, r0 + 2 * dir);
		}
		for (const df of [-1, 1])
			if (enemy(at(f0 + df, r0 + dir))) add(f0 + df, r0 + dir);
		return out;
	}
	const steps = {
		n: [
			[1, 2],
			[2, 1],
			[2, -1],
			[1, -2],
			[-1, -2],
			[-2, -1],
			[-2, 1],
			[-1, 2],
		],
		k: [
			[1, 0],
			[1, 1],
			[0, 1],
			[-1, 1],
			[-1, 0],
			[-1, -1],
			[0, -1],
			[1, -1],
		],
	};
	if (steps[type]) {
		for (const [df, dr] of steps[type]) {
			const p = at(f0 + df, r0 + dr);
			if (p === null || enemy(p)) add(f0 + df, r0 + dr);
		}
		return out;
	}
	const dirs = {
		r: [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		],
		b: [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1],
		],
	};
	const use = type === "q" ? [...dirs.r, ...dirs.b] : dirs[type];
	for (const [df, dr] of use) {
		let f = f0 + df;
		let r = r0 + dr;
		for (;;) {
			const p = at(f, r);
			if (p === undefined) break;
			if (p === null) add(f, r);
			else {
				if (enemy(p)) add(f, r);
				break;
			}
			f += df;
			r += dr;
		}
	}
	return out;
}

/* ------------------------------------------------------------------------------ the course list */

function courseStats(app, course) {
	const done = course.lessons.filter(
		(l) => app.progress.lessons[lessonKey(course.id, l.id)]?.done,
	).length;
	return { done, total: course.lessons.length };
}

function renderHome(app, el) {
	el.innerHTML = `<div class="page"><div class="page-in">
		<div class="page-head"><div><h1>Learn chess</h1><p class="lead">From the first move to the ideas strong players think about. Every lesson is on the board: you read a little, then you play.</p></div></div>
		<div class="courses">${COURSES.map((c, i) => {
			const s = courseStats(app, c);
			const pct = Math.round((s.done / s.total) * 100);
			return `<button class="course" data-course="${c.id}"><span class="course-art" aria-hidden="true">${courseArt(i)}</span>
				<span class="course-body"><span class="course-level">${esc(c.level)}</span><b>${esc(c.title)}</b><span class="muted small">${esc(c.about)}</span>
				<span class="meter"><i style="width:${pct}%"></i></span><span class="muted small">${s.done} of ${s.total} lessons${s.done === s.total ? " · done" : ""}</span></span></button>`;
		}).join("")}</div></div></div>`;
	for (const b of el.querySelectorAll("[data-course]"))
		b.onclick = () => app.go("learn", { course: b.dataset.course });
}

function courseArt(i) {
	// one piece per course, in the flat set
	const p = ["p", "n", "k", "b", "r", "q"][i % 6];
	return pieceSvg(p, i % 2 ? "b" : "w");
}

function renderCourse(app, el, course) {
	const nextUp = course.lessons.find(
		(l) => !app.progress.lessons[lessonKey(course.id, l.id)]?.done,
	);
	el.innerHTML = `<div class="page"><div class="page-in">
		<button class="btn ghost sm back" data-back>${icon("prev")}All courses</button>
		<div class="page-head"><div><span class="course-level">${esc(course.level)}</span><h1>${esc(course.title)}</h1><p class="lead">${esc(course.about)}</p></div>
		${nextUp ? `<button class="btn primary" data-start="${nextUp.id}">${icon("play")}${course.lessons[0] === nextUp ? "Start" : "Continue"}</button>` : ""}</div>
		<ol class="lessons">${course.lessons
			.map((l) => {
				const done = app.progress.lessons[lessonKey(course.id, l.id)]?.done;
				const kinds = [
					...new Set(l.steps.map((s) => s.task?.type).filter(Boolean)),
				];
				return `<li><button data-lesson="${l.id}" class="${done ? "done" : ""}"><span class="lnum">${done ? icon("check") : ""}</span><span class="ltitle"><b>${esc(l.title)}</b><span class="muted small">${l.steps.length} ${l.steps.length === 1 ? "step" : "steps"}${kinds.includes("puzzles") ? ", puzzles" : ""}${kinds.includes("play") ? ", play it out" : ""}</span></span>${icon("next")}</button></li>`;
			})
			.join("")}</ol></div></div>`;
	el.querySelector("[data-back]").onclick = () => app.go("learn");
	for (const b of el.querySelectorAll("[data-lesson]"))
		b.onclick = () =>
			app.go("learn", { course: course.id, lesson: b.dataset.lesson });
	el.querySelector("[data-start]")?.addEventListener("click", (e) =>
		app.go("learn", {
			course: course.id,
			lesson: e.currentTarget.dataset.start,
		}),
	);
}

/* ------------------------------------------------------------------------------ a lesson */

async function runLesson(app, el, course, lesson, startStep = 0) {
	el.innerHTML = `<div class="play lesson"><div class="stage"><div class="stage-tools"><button class="iconbtn" data-flip title="Turn the board" aria-label="Turn the board">${icon("flip")}</button></div></div><aside class="side"><div class="lsn" data-lsn></div></aside></div>`;
	const stage = el.querySelector(".stage");
	const side = el.querySelector("[data-lsn]");
	let alive = true;
	let handler = null; // what a move on the board means in this step
	let stepIndex = startStep;
	let complete = false;
	const cleanup = [];
	const board = await app.board(stage, {
		tray: false,
		onMove: (m) => handler?.(m),
	});
	if (!alive) return {};
	el.querySelector("[data-flip]").onclick = () => board.flip();

	const key = lessonKey(course.id, lesson.id);
	const steps = lesson.steps;

	function feedback(html, kind = "") {
		const f = side.querySelector("[data-feedback]");
		if (f) {
			f.className = `feedback ${kind}`;
			f.innerHTML = html;
		}
	}
	function setComplete(ok = true) {
		complete = ok;
		const n = side.querySelector("[data-next]");
		if (n) n.disabled = !ok;
		if (ok) n?.focus({ preventScroll: true });
	}

	async function render() {
		for (const c of cleanup.splice(0)) c();
		handler = null;
		const step = steps[stepIndex];
		const t = step.task;
		complete = !t;
		const last = stepIndex === steps.length - 1;
		side.innerHTML = `<div class="lsn-top"><button class="btn ghost sm" data-course>${icon("prev")}${esc(course.title)}</button><span class="dots">${steps.map((_, i) => `<i class="${i < stepIndex ? "past" : i === stepIndex ? "now" : ""}"></i>`).join("")}</span></div>
			<h2>${esc(lesson.title)}</h2>
			${step.say ? `<p class="say">${rich(step.say)}</p>` : ""}
			<div class="task" data-task></div>
			<div class="feedback" data-feedback aria-live="polite"></div>
			<div class="lsn-foot"><button class="btn" data-prev ${stepIndex === 0 ? "disabled" : ""}>${icon("prev")}Back</button>
				<button class="btn ghost" data-ask>${icon("ask")}Ask ${esc(app.bot().name)}</button>
				<button class="btn primary" data-next ${complete ? "" : "disabled"}>${last ? "Finish" : "Next"}${icon("next")}</button></div>`;
		side.querySelector("[data-course]").onclick = () =>
			app.go("learn", { course: course.id });
		side.querySelector("[data-prev]").onclick = () => {
			if (stepIndex > 0) {
				stepIndex--;
				render();
			}
		};
		side.querySelector("[data-next]").onclick = () => {
			if (!complete) return;
			if (last) return finishLesson();
			stepIndex++;
			render();
		};
		side.querySelector("[data-ask]").onclick = () => ask(step);
		const orient =
			step.you ??
			t?.you ??
			(step.fen ? (step.fen.split(" ")[1] === "b" && t ? "b" : "w") : "w");
		board.orient(orient);
		const taskEl = side.querySelector("[data-task]");
		try {
			if (!t) await showFen(step);
			else if (t.type === "sandbox") await sandbox(step, t);
			else if (t.type === "quiz") await quiz(step, t, taskEl);
			else if (["move", "check", "mate"].includes(t.type))
				await findMove(step, t);
			else if (t.type === "line") await line(step, t, taskEl);
			else if (t.type === "best") await best(step, t);
			else if (t.type === "play") await playOut(step, t, taskEl);
			else if (t.type === "puzzles") await puzzles(step, t, taskEl);
			else if (t.type === "go-play") goPlay(step, t, taskEl);
		} catch (error) {
			console.error(error);
			feedback(`This step could not start: ${esc(error.message)}`, "bad");
			setComplete(true);
		}
	}

	async function showFen(step) {
		await board.set({
			pieces: step.fen ? piecesFromFen(step.fen) : {},
			last: null,
			check: null,
			movable: null,
			arrows: arrowsOf(step.arrows),
			marks: step.marks ?? {},
		});
	}

	/* --- sandbox: one piece and the stars */
	async function sandbox(step, t) {
		const pieces = {};
		for (const s of t.own ?? []) pieces[s] = `${t.piece[0]}p`;
		for (const s of t.stars) pieces[s] = t.piece[0] === "w" ? "bp" : "wp";
		let at = t.from;
		pieces[at] = t.piece;
		let moves = 0;
		const marks = () =>
			Object.fromEntries(
				t.stars
					.filter((s) => pieces[s] && pieces[s] !== t.piece)
					.map((s) => [s, "target"]),
			);
		const show = (move = null) =>
			board.set({
				pieces: { ...pieces },
				last: null,
				check: null,
				arrows: [],
				marks: marks(),
				movable: {
					colour: t.piece[0],
					dests: new Map([[at, sandboxDests(t.piece, at, pieces)]]),
				},
				move,
			});
		feedback(`Stars left: <b>${t.stars.length}</b>`);
		handler = async ({ from, to, dropped }) => {
			if (from !== at) return;
			const took = Boolean(pieces[to]);
			delete pieces[at];
			pieces[to] = t.piece;
			at = to;
			moves++;
			play(took ? "capture" : "move");
			const left = t.stars.filter(
				(s) => pieces[s] && pieces[s] !== t.piece,
			).length;
			// a pawn on the last rank: done with it
			await show({ from, to, dropped });
			if (!left) {
				play("correct");
				feedback(
					`<b>All stars captured</b> in ${moves} ${moves === 1 ? "move" : "moves"}${t.par && moves <= t.par ? ". Perfect!" : t.par ? `. It can be done in ${t.par}: try again if you like.` : "."} <button class="btn sm" data-again>${icon("refresh")}Again</button>`,
					"good",
				);
				side.querySelector("[data-again]").onclick = () => render();
				board.set({ movable: null });
				setComplete(true);
			} else feedback(`Stars left: <b>${left}</b> · moves: ${moves}`);
		};
		await show();
	}

	/* --- a question */
	async function quiz(step, t, taskEl) {
		await showFen(step);
		taskEl.innerHTML = `<p class="q">${rich(t.q)}</p><div class="options">${t.options.map((o, i) => `<button class="opt" data-opt="${i}">${esc(o)}</button>`).join("")}</div>`;
		for (const b of taskEl.querySelectorAll("[data-opt]"))
			b.onclick = () => {
				const i = Number(b.dataset.opt);
				if (i === t.answer) {
					b.classList.add("right");
					for (const x of taskEl.querySelectorAll("[data-opt]"))
						x.disabled = true;
					play("correct");
					feedback(`<b>Right.</b> ${rich(t.explain ?? "")}`, "good");
					setComplete(true);
				} else {
					b.classList.add("wrong");
					b.disabled = true;
					play("wrong");
					feedback("Not that one. Try again.", "bad");
				}
			};
	}

	/* --- find one move */
	async function findMove(step, t) {
		const game = new Game(step.fen);
		const you = game.turn;
		let tries = 0;
		const want = (t.moves ?? [])
			.map((m) => new Game(step.fen).move(m)?.uci)
			.filter(Boolean);
		const show = (move = null, extra = {}) =>
			board.set({
				...stateOf(game, { canMove: complete ? null : you }),
				arrows: arrowsOf(step.arrows),
				marks: step.marks ?? {},
				move,
				...extra,
			});
		feedback(
			t.type === "mate"
				? "Find the checkmate."
				: t.type === "check"
					? "Give check."
					: "Your move.",
		);
		handler = async ({ from, to, dropped }) => {
			if (complete) return;
			const options = game
				.legalMoves()
				.filter((m) => m.from === from && m.to === to);
			if (!options.length) return show();
			const promo = options.find((m) => m.promotion === "q") ?? options[0];
			const mv = game.move({ from, to, promotion: promo.promotion });
			if (!mv) return show();
			let ok;
			if (t.type === "mate") ok = game.over()?.reason === "checkmate";
			else if (t.type === "check") ok = mv.check;
			else ok = want.includes(mv.uci);
			play(moveSound(mv, { check: mv.check }));
			if (ok) {
				complete = true;
				await show(moveHint(mv, dropped), {
					marks: { [mv.to]: "good" },
					arrows: [],
				});
				play("correct");
				feedback(
					`<b>${esc(mv.san)}</b>: ${rich(t.success ?? "Well done.")}`,
					"good",
				);
				setComplete(true);
				return;
			}
			tries++;
			await show(moveHint(mv, dropped), { marks: { [mv.to]: "bad" } });
			play("wrong");
			const reason =
				game.over()?.reason === "stalemate"
					? "That is stalemate, a draw!"
					: t.type === "mate"
						? mv.check
							? "Check, but the king can escape."
							: "That does not give checkmate."
						: t.type === "check"
							? "That is not a check."
							: "Not this one.";
			await sleep(650);
			game.undo();
			const tip =
				tries >= 2 && want[0]
					? [
							{
								from: want[0].slice(0, 2),
								to: want[0].slice(2, 4),
								kind: "hint",
							},
						]
					: null;
			await show(null, tip ? { arrows: tip } : {});
			feedback(
				`${reason} Try again.${tip ? " The arrow shows one answer." : ""}`,
				"bad",
			);
		};
		await show();
	}

	/* --- an opening, your side of it */
	async function line(step, t, taskEl) {
		const game = new Game(step.fen);
		const you = t.you ?? "w";
		board.orient(you);
		const moves = t.moves;
		let tries = 0;
		const expectedUci = () => {
			const g = new Game(step.fen);
			for (const h of game.history) g.move(h.uci);
			return g.move(moves[game.history.length])?.uci;
		};
		const show = (move = null, extra = {}) => {
			const done = game.history.length >= moves.length;
			return board.set({
				...stateOf(game, { canMove: !done && game.turn === you ? you : null }),
				move,
				...extra,
			});
		};
		const note = () => {
			// the latest note so far: a reply does not wipe the note on your own move
			let n = null;
			for (let i = game.history.length; i > 0 && !n; i--)
				n = t.notes?.[i] ?? null;
			const sans = game.history
				.map((h, i) => (i % 2 === 0 ? `${i / 2 + 1}.${h.san}` : h.san))
				.join(" ");
			taskEl.innerHTML = `<p class="line-moves">${esc(sans) || "&nbsp;"}</p>${n ? `<p class="note-card">${rich(n)}</p>` : ""}`;
		};
		async function reply() {
			while (game.history.length < moves.length && game.turn !== you) {
				await sleep(450);
				if (!alive) return;
				const mv = game.move(moves[game.history.length]);
				play(moveSound(mv, { check: mv.check }));
				await show(moveHint(mv));
				note();
			}
			if (game.history.length >= moves.length) {
				play("correct");
				feedback(
					`<b>That's the line.</b> <button class="btn sm" data-playon>${icon("play")}Play on from here</button>`,
					"good",
				);
				side.querySelector("[data-playon]").onclick = () =>
					app.go("play", { startFen: game.fen(), you });
				setComplete(true);
			} else feedback("Your move.");
		}
		handler = async ({ from, to, dropped }) => {
			if (game.turn !== you || game.history.length >= moves.length) return;
			const want = expectedUci();
			const options = game
				.legalMoves()
				.filter((m) => m.from === from && m.to === to);
			if (!options.length) return show();
			const mv = game.move({ from, to, promotion: options[0].promotion });
			if (mv.uci !== want) {
				game.undo();
				tries++;
				play("wrong");
				const arrow =
					tries >= 2
						? [{ from: want.slice(0, 2), to: want.slice(2, 4), kind: "hint" }]
						: [];
				await show(null, { arrows: arrow, marks: { [to]: "bad" } });
				feedback(
					`${mv.san} is playable, but this opening goes another way. ${tries >= 2 ? "Follow the arrow." : "Try again."}`,
					"bad",
				);
				return;
			}
			tries = 0;
			play(moveSound(mv, { check: mv.check }));
			await show(moveHint(mv, dropped));
			note();
			reply();
		};
		await show();
		note();
		if (game.turn !== you) reply();
		else feedback("Your move.");
	}

	/* --- find a good move; the engine judges */
	async function best(step, t) {
		const game = new Game(step.fen);
		const you = game.turn;
		const sign = you === "w" ? 1 : -1;
		const base = app.engine.analyse({ fen: step.fen, moves: [], ms: 1200 });
		base.catch(() => {});
		cleanup.push(() => app.engine.cancel());
		const show = (move = null, extra = {}) =>
			board.set({
				...stateOf(game, { canMove: complete ? null : you }),
				arrows: arrowsOf(step.arrows),
				marks: step.marks ?? {},
				move,
				...extra,
			});
		feedback("Your move.");
		handler = async ({ from, to, dropped }) => {
			if (complete || game.history.length) return;
			const options = game
				.legalMoves()
				.filter((m) => m.from === from && m.to === to);
			if (!options.length) return show();
			const mv = game.move({
				from,
				to,
				promotion:
					options.find((m) => m.promotion === "q")?.promotion ??
					options[0].promotion,
			});
			play(moveSound(mv, { check: mv.check }));
			await show(moveHint(mv, dropped), { movable: null });
			feedback(`Checking ${esc(mv.san)}…`);
			try {
				const before = await base;
				const bestScore = before.score * sign;
				let after;
				if (before.move === mv.uci) after = before;
				else
					after = await app.engine.analyse({
						fen: step.fen,
						moves: [mv.uci],
						ms: 900,
					});
				const got = after.score * sign;
				const bestSan = new Game(step.fen).move(before.move)?.san;
				if (before.move === mv.uci || bestScore - got <= (t.tolerance ?? 50)) {
					complete = true;
					await show(null, { marks: { [mv.to]: "good" } });
					play("correct");
					feedback(
						`<b>${esc(mv.san)}</b>: ${rich(t.success ?? "A good move.")}${before.move !== mv.uci && bestSan ? ` The engine's own choice was ${esc(bestSan)}.` : ""}`,
						"good",
					);
					setComplete(true);
				} else {
					play("wrong");
					await show(null, { marks: { [mv.to]: "bad" } });
					feedback(`${esc(mv.san)} is not the best here. Look again.`, "bad");
					await sleep(800);
					game.undo();
					await show();
				}
			} catch (error) {
				if (!error?.cancelled)
					feedback(
						`The engine could not check the move: ${esc(error.message)}`,
						"bad",
					);
				game.undo();
				show();
			}
		};
		await show();
	}

	/* --- play it out against the engine */
	async function playOut(step, t, taskEl) {
		let game = new Game(step.fen);
		const you = step.you ?? game.turn;
		board.orient(you);
		let moved = 0;
		let busy = false;
		const goalText = {
			mate: "Checkmate the king",
			promote: "Promote your pawn",
			"capture-pawns": "Capture the pawn",
			hold: "Hold the position",
		}[t.goal];
		const status = () => {
			taskEl.innerHTML = `<p class="goal">${icon("target")}<b>${esc(goalText)}</b>${t.maxMoves ? ` <span class="muted small">within ${t.maxMoves} moves · move ${moved}</span>` : ""}</p><button class="btn sm" data-restart>${icon("refresh")}Start over</button>`;
			taskEl.querySelector("[data-restart]").onclick = restart;
		};
		const show = (move = null) =>
			board.set({
				...stateOf(game, {
					canMove: !complete && !busy && game.turn === you ? you : null,
				}),
				arrows: [],
				marks: {},
				move,
			});
		function restart() {
			app.engine.cancel();
			game = new Game(step.fen);
			moved = 0;
			busy = false;
			complete = false;
			setComplete(false);
			feedback("");
			status();
			show();
			if (game.turn !== you) engineMove();
		}
		function judgeEnd() {
			const over = game.over();
			const theirs = you === "w" ? "b" : "w";
			if (
				t.goal === "mate" &&
				over?.reason === "checkmate" &&
				game.turn === theirs
			)
				return win("Checkmate!");
			if (
				t.goal === "promote" &&
				game.history.some((h) => h.colour === you && h.promotion)
			)
				return win("Promoted!");
			if (
				t.goal === "capture-pawns" &&
				!game
					.board()
					.flat()
					.some((p) => p && p.colour === theirs && p.type === "p")
			)
				return win("Caught it!");
			if (t.goal === "hold") {
				if (over && over.result === "1/2-1/2")
					return win(`Drawn: ${over.reason}.`);
				if (moved >= t.maxMoves && !over)
					return win(`Held for ${t.maxMoves} moves.`);
			}
			if (over)
				return lose(
					over.reason === "stalemate"
						? "Stalemate: a draw, not a win."
						: over.reason === "checkmate"
							? "Checkmated."
							: over.reason === "insufficient material"
								? "A piece was lost, and nobody can mate now."
								: `The game ended: ${over.reason}.`,
				);
			if (t.maxMoves && moved >= t.maxMoves && t.goal !== "hold")
				return lose(`Not within ${t.maxMoves} moves.`);
			return false;
		}
		function win(text) {
			complete = true;
			play("win");
			feedback(`<b>${esc(text)}</b>`, "good");
			setComplete(true);
			show();
			return true;
		}
		function lose(text) {
			play("lose");
			feedback(
				`${esc(text)} <button class="btn sm" data-again>${icon("refresh")}Try again</button>`,
				"bad",
			);
			side.querySelector("[data-again]").onclick = restart;
			busy = true;
			show();
			return true;
		}
		async function engineMove() {
			busy = true;
			show();
			try {
				const r = await app.engine.move({
					fen: step.fen,
					moves: game.history.map((h) => h.uci),
					level: t.level ?? "expert",
					ms: LEVELS[t.level ?? "expert"].ms ? 600 : undefined,
				});
				if (!alive) return;
				const mv = game.move(r.move);
				busy = false;
				if (mv) {
					play(moveSound(mv, { check: mv.check }));
					await show(moveHint(mv));
				}
				status();
				judgeEnd();
			} catch (error) {
				if (!error?.cancelled) feedback(esc(error.message), "bad");
			}
		}
		handler = async ({ from, to, dropped }) => {
			if (busy || complete || game.turn !== you) return;
			const options = game
				.legalMoves()
				.filter((m) => m.from === from && m.to === to);
			if (!options.length) return show();
			const mv = game.move({
				from,
				to,
				promotion:
					options.find((m) => m.promotion === "q")?.promotion ??
					options[0]?.promotion,
			});
			if (!mv) return show();
			moved++;
			play(moveSound(mv, { check: mv.check }));
			await show(moveHint(mv, dropped));
			status();
			if (judgeEnd()) return;
			engineMove();
		};
		cleanup.push(() => app.engine.cancel());
		status();
		await show();
		feedback(`You play ${you === "w" ? "White" : "Black"}.`);
		if (game.turn !== you) engineMove();
	}

	/* --- a few puzzles of a theme */
	async function puzzles(step, t, taskEl) {
		const all = await loadPuzzles();
		const P = app.progress.puzzle;
		let solved = 0;
		let index = 0;
		let current = null;
		const seen = new Set();
		async function next() {
			if (!alive) return;
			if (index >= t.count) {
				play("correct");
				feedback(
					`<b>Done:</b> ${solved} of ${t.count} solved without help.`,
					"good",
				);
				setComplete(true);
				return;
			}
			index++;
			const target = Math.min(t.max ?? 3000, Math.max(600, P.rating - 100));
			do
				current = pickPuzzle(all, {
					rating: target,
					theme: t.theme,
					solved: {},
					near: 150,
					exclude: current?.id,
				});
			while (seen.has(current.id) && seen.size < 40);
			seen.add(current.id);
			taskEl.innerHTML = `<p class="goal">${icon("puzzle")}<b>Puzzle ${index} of ${t.count}</b> <span class="muted small">rated ${current.rating}</span></p><div class="row"><button class="btn sm" data-hint>${icon("hint")}Hint</button><button class="btn sm" data-solution>${icon("view")}Solution</button></div>`;
			let hintLevel = 0;
			const run = runPuzzle(board, current, {
				onState: (state) => {
					if (state === "your-move")
						feedback(
							`<b>${run.you === "w" ? "White" : "Black"} to move.</b> Find the best move.`,
						);
					else if (state === "wrong")
						feedback("Not this one. Try again.", "bad");
					else if (state === "right")
						feedback("<b>Yes!</b> Keep going.", "good");
				},
			});
			handler = (m) => run.onMove(m);
			taskEl.querySelector("[data-hint]").onclick = () => {
				hintLevel = Math.min(2, hintLevel + 1);
				run.hint(hintLevel);
			};
			taskEl.querySelector("[data-solution]").onclick = () => run.reveal();
			const result = await run.done;
			if (!alive || steps[stepIndex] !== step) return;
			if (result.solved && result.firstTry && !hintLevel) solved++;
			if (result.solved) P.solved[current.id] = Date.now();
			app.saveProgress();
			feedback(
				result.solved ? "<b>Solved!</b>" : "There's the solution.",
				result.solved ? "good" : "",
			);
			await sleep(1300);
			next();
		}
		next();
	}

	function goPlay(step, t, taskEl) {
		showFen(step);
		taskEl.innerHTML = `<button class="btn primary" data-go>${icon("play")}${esc(t.label ?? "Play a game")}</button>`;
		taskEl.querySelector("[data-go]").onclick = () => {
			markDone();
			app.settings.level = t.level ?? "beginner";
			app.settings.mover = "engine";
			app.saveSettings();
			app.go("play", { setup: true });
		};
		setComplete(true);
	}

	function markDone() {
		app.progress.lessons[key] = { done: true, at: Date.now() };
		app.saveProgress();
	}

	function finishLesson() {
		markDone();
		const i = course.lessons.indexOf(lesson);
		const next = course.lessons[i + 1];
		const nextCourse = !next ? COURSES[COURSES.indexOf(course) + 1] : null;
		play("win");
		const div = document.createElement("div");
		div.className = "over";
		div.innerHTML = `<div class="card"><div class="face">${(app.bot().faces?.celebrate ?? "") || pieceSvg("k", "w")}</div><h2>Lesson complete</h2><p>${esc(lesson.title)}: done.${next ? ` Next up: ${esc(next.title)}.` : nextCourse ? ` That was the last lesson of ${esc(course.title)}.` : " That was the last lesson of all. Well done!"}</p>
			<div class="row">${next ? `<button class="btn primary" data-next-lesson>${icon("next")}Next lesson</button>` : nextCourse ? `<button class="btn primary" data-next-course>${icon("next")}${esc(nextCourse.title)}</button>` : ""}<button class="btn" data-list>All lessons</button></div></div>`;
		stage.appendChild(div);
		div
			.querySelector("[data-next-lesson]")
			?.addEventListener("click", () =>
				app.go("learn", { course: course.id, lesson: next.id }),
			);
		div
			.querySelector("[data-next-course]")
			?.addEventListener("click", () =>
				app.go("learn", { course: nextCourse.id }),
			);
		div.querySelector("[data-list]").onclick = () =>
			app.go("learn", { course: course.id });
	}

	function ask(step) {
		const context = [
			`The person is taking a chess lesson in the Chess app, open beside this conversation: course "${course.title}", lesson "${lesson.title}", step ${stepIndex + 1} of ${steps.length}.`,
			step.say ? `The lesson says: ${step.say.replace(/\*/g, "")}` : "",
			step.task?.type === "quiz"
				? `The question: ${step.task.q} Options: ${step.task.options.join(" / ")}.`
				: "",
			step.fen ? `The board (FEN): ${step.fen}` : "",
			"Answer as a patient chess teacher: plain words, short, at the level of this lesson. If they ask for the answer to a task, give a hint first.",
		]
			.filter(Boolean)
			.join("\n");
		app.ask("I have a question about this lesson step.", context);
	}

	const onKey = (e) => {
		if (e.target.closest?.("input, textarea")) return;
		if (e.key === "ArrowRight" && complete)
			side.querySelector("[data-next]")?.click();
		else if (e.key === "ArrowLeft") side.querySelector("[data-prev]")?.click();
	};
	document.addEventListener("keydown", onKey);
	await render();
	return {
		destroy() {
			alive = false;
			for (const c of cleanup.splice(0)) c();
			document.removeEventListener("keydown", onKey);
			board.destroy();
		},
	};
}

export async function mountLearn(app, el, params = {}) {
	if (params.course && params.lesson) {
		const found = findLesson(params.course, params.lesson);
		if (found)
			return runLesson(
				app,
				el,
				found.course,
				found.lesson,
				Number(params.step) || 0,
			);
		toast("That lesson is not here.");
	}
	if (params.course) {
		const course = COURSES.find((c) => c.id === params.course);
		if (course) {
			renderCourse(app, el, course);
			return {};
		}
	}
	renderHome(app, el);
	return {};
}
