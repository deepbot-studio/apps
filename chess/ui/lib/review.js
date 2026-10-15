/*
 * REVIEW: a finished game, move by move, with the engine's eye. Every position is analysed in the
 * background; moves that threw away a winning chance are marked (?? blunder, ? mistake, ?!
 * inaccuracy), each side gets an accuracy, the evaluation is drawn as a graph you can click, and
 * any move can be explained by the Bot beside the page, or played on from.
 */
import { stateOf } from "./boardview.js";
import { isMate, scoreText } from "./engine.js";
import { Game } from "./rules.js";
import { play } from "./sound.js";
import { download, esc, faceSvg, icon, toast } from "./ui.js";

const winP = (cp) => 1 / (1 + Math.exp(-0.00368208 * cp));
/** Mate scores folded into the same scale: a mate is worth "everything", sooner a bit more. */
const fold = (cp) =>
	isMate(cp) ? Math.sign(cp) * (10000 - (30000 - Math.abs(cp))) : cp;

export function classify(lossPct) {
	if (lossPct >= 30) return "blunder";
	if (lossPct >= 20) return "mistake";
	if (lossPct >= 10) return "inaccuracy";
	return null;
}
const MARK = { blunder: "??", mistake: "?", inaccuracy: "?!" };
const WORD = {
	blunder: "a blunder",
	mistake: "a mistake",
	inaccuracy: "an inaccuracy",
};

export function accuracyOf(losses) {
	if (!losses.length) return null;
	const each = losses.map((l) =>
		Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * l) - 3.1669)),
	);
	return Math.round(each.reduce((a, b) => a + b, 0) / each.length);
}

function sanLine(fen, ucis, max = 6) {
	const g = new Game(fen);
	const out = [];
	for (const u of ucis.slice(0, max)) {
		const mv = g.move(u);
		if (!mv) break;
		out.push(mv.san);
	}
	return out;
}

export async function mountReview(app, el, params = {}) {
	let game;
	try {
		game = Game.fromPgn(params.pgn ?? "");
	} catch (error) {
		el.innerHTML = `<div class="setup"><h2>This game cannot be read</h2><p class="lead">${esc(error.message)}</p><div><button class="btn" data-back>Back</button></div></div>`;
		el.querySelector("[data-back]").onclick = () => app.go("games");
		return {};
	}
	const h = game.headers;
	const you =
		params.you ?? (h.White === "You" ? "w" : h.Black === "You" ? "b" : "w");
	const bot =
		app.bots.find((b) => b.id === params.bot) ??
		app.bots.find((b) => b.name === (you === "w" ? h.Black : h.White)) ??
		app.bot();
	const plies = game.history.length;
	const evals = new Array(plies + 1).fill(null); // { score (white), best, pv }
	let cur = plies;
	let alive = true;
	let showBest = false;

	el.innerHTML = `<div class="play review"><div class="stage"><div class="stage-tools"><button class="iconbtn" data-flip title="Turn the board" aria-label="Turn the board">${icon("flip")}</button></div></div><aside class="side">
		<div class="rv-head"><div><h2>Game review</h2><p class="muted small">${esc(h.White ?? "White")} vs ${esc(h.Black ?? "Black")} · ${esc(h.Result ?? "*")}${h.Termination ? ` · ${esc(h.Termination)}` : ""}</p></div></div>
		<div class="rv-acc" data-acc></div>
		<div class="rv-graph" data-graph></div>
		<div class="rv-progress" data-progress></div>
		<div class="moves" data-moves></div>
		<div class="rv-detail" data-detail></div>
		<div class="browse"><button class="iconbtn" data-nav="first" aria-label="First position">${icon("first")}</button><button class="iconbtn" data-nav="prev" aria-label="Previous move">${icon("prev")}</button><button class="iconbtn" data-nav="next" aria-label="Next move">${icon("next")}</button><button class="iconbtn" data-nav="last" aria-label="Last position">${icon("last")}</button><span class="grow"></span>
			<button class="iconbtn" data-download title="Download the game (PGN)" aria-label="Download the game">${icon("download")}</button></div>
	</aside></div>`;
	const stage = el.querySelector(".stage");
	const side = el.querySelector(".side");
	const board = await app.board(stage, { orientation: you });
	if (!alive) return {};
	el.querySelector("[data-flip]").onclick = () => board.flip();
	side.querySelector("[data-download]").onclick = () =>
		download(
			`${(h.Date ?? "game").replaceAll(".", "-")}-${(h.White ?? "white").toLowerCase()}-vs-${(h.Black ?? "black").toLowerCase()}.pgn`.replace(
				/[^a-z0-9.-]+/gi,
				"-",
			),
			params.pgn,
			"application/x-chess-pgn",
		);
	for (const b of side.querySelectorAll("[data-nav]"))
		b.onclick = () => {
			const t = b.dataset.nav;
			go(
				t === "first"
					? 0
					: t === "prev"
						? cur - 1
						: t === "next"
							? cur + 1
							: plies,
			);
		};

	/** Loss in winning chances (percentage points) of the move that led to ply n, for its mover. */
	function lossAt(n) {
		const before = evals[n - 1];
		const after = evals[n];
		if (!before || !after) return null;
		const mover = game.history[n - 1].colour;
		const sign = mover === "w" ? 1 : -1;
		return Math.max(
			0,
			(winP(fold(before.score) * sign) - winP(fold(after.score) * sign)) * 100,
		);
	}
	const tagAt = (n) => {
		const l = lossAt(n);
		return l == null ? null : classify(l);
	};

	function renderMoves() {
		const movesEl = side.querySelector("[data-moves]");
		const startBlack = game.startFen.split(" ")[1] === "b";
		let num = Number(game.startFen.split(" ")[5]) || 1;
		const btn = (i) => {
			const t = tagAt(i + 1);
			return `<button data-ply="${i + 1}" class="${cur === i + 1 ? "cur" : ""}">${esc(game.history[i].san)}${t ? `<span class="tag ${t}" title="${WORD[t][0].toUpperCase()}${WORD[t].slice(1)}">${MARK[t]}</span>` : ""}</button>`;
		};
		let html = `<span class="n"></span><button data-ply="0" class="${cur === 0 ? "cur" : ""}" style="grid-column:span 2;font-weight:400;color:var(--mut)">Starting position</button>`;
		let i = 0;
		if (startBlack && plies) {
			html += `<span class="n">${num}.</span><span></span>${btn(0)}`;
			i = 1;
			num++;
		}
		for (; i < plies; i += 2) {
			html += `<span class="n">${num}.</span>${btn(i)}${i + 1 < plies ? btn(i + 1) : "<span></span>"}`;
			num++;
		}
		movesEl.innerHTML = html;
		for (const b of movesEl.querySelectorAll("[data-ply]"))
			b.onclick = () => go(Number(b.dataset.ply));
		movesEl.querySelector(".cur")?.scrollIntoView({ block: "nearest" });
	}

	function renderAccuracy() {
		const acc = { w: [], b: [] };
		for (let n = 1; n <= plies; n++) {
			const l = lossAt(n);
			if (l != null) acc[game.history[n - 1].colour].push(l);
		}
		const count = (colour, kind) =>
			game.history.filter(
				(m, i) => m.colour === colour && tagAt(i + 1) === kind,
			).length;
		// in words, zeros left out: "2 mistakes, 1 inaccuracy"
		const countsText = (colour) => {
			const parts = [
				["blunder", "blunder", "blunders"],
				["mistake", "mistake", "mistakes"],
				["inaccuracy", "inaccuracy", "inaccuracies"],
			]
				.map(([kind, one, many]) => {
					const n = count(colour, kind);
					return n
						? `<span class="tag ${kind}">${n} ${n === 1 ? one : many} ${MARK[kind]}</span>`
						: "";
				})
				.filter(Boolean);
			if (accuracyOf(acc[colour]) == null) return "";
			return parts.length
				? parts.join("<br>")
				: `<span class="tag best">No mistakes</span>`;
		};
		const row = (colour) => {
			const a = accuracyOf(acc[colour]);
			const name = colour === "w" ? (h.White ?? "White") : (h.Black ?? "Black");
			return `<div class="rv-side"><b>${esc(name)}</b><span class="rv-num">${a == null ? "…" : `${a}%`}</span><span class="muted small">accuracy</span>
				<span class="rv-counts">${countsText(colour)}</span></div>`;
		};
		side.querySelector("[data-acc]").innerHTML = row("w") + row("b");
	}

	function renderGraph() {
		const W = 320;
		const H = 64;
		const pts = [];
		for (let n = 0; n <= plies; n++) {
			const e = evals[n];
			if (!e) continue;
			const x = plies ? (n / plies) * W : 0;
			const y = H - winP(fold(e.score)) * H;
			pts.push([x, y]);
		}
		const area =
			pts.length > 1
				? `M0 ${H} ${pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L${pts.at(-1)[0].toFixed(1)} ${H} Z`
				: "";
		const cx = plies ? (cur / plies) * W : 0;
		const marks = [];
		for (let n = 1; n <= plies; n++) {
			const t = tagAt(n);
			if (t === "blunder" || t === "mistake") {
				const e = evals[n];
				marks.push(
					`<circle cx="${((n / plies) * W).toFixed(1)}" cy="${(H - winP(fold(e.score)) * H).toFixed(1)}" r="2.6" class="gm ${t}"/>`,
				);
			}
		}
		side.querySelector("[data-graph]").innerHTML =
			`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="How the game went: white's chances over the moves"><rect width="${W}" height="${H}" class="gb"/><path d="${area}" class="ga"/><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="gmid"/><line x1="${cx}" x2="${cx}" y1="0" y2="${H}" class="gcur"/>${marks.join("")}</svg>`;
		const svg = side.querySelector("[data-graph] svg");
		svg.onclick = (e) => {
			const r = svg.getBoundingClientRect();
			go(Math.round(((e.clientX - r.left) / r.width) * plies));
		};
	}

	function renderDetail() {
		const d = side.querySelector("[data-detail]");
		if (cur === 0) {
			d.innerHTML = `<p class="muted small">The starting position. Step through the game with the arrows, or click a move.</p>`;
			return;
		}
		const mv = game.history[cur - 1];
		const before = evals[cur - 1];
		const after = evals[cur];
		const t = tagAt(cur);
		const num = `${Math.ceil(cur / 2)}${mv.colour === "w" ? "." : "..."}`;
		const who =
			mv.colour === you
				? "You"
				: (mv.colour === "w" ? h.White : h.Black) || "They";
		let text;
		if (!before || !after) text = `<span class="muted">Analysing…</span>`;
		else {
			const fenBefore = game.at(cur - 1).fen();
			const bestSan = sanLine(fenBefore, [before.best])[0];
			const wasBest = before.best === mv.uci;
			const evalTxt = scoreText(after.score);
			if (wasBest)
				text = `<b>${num} ${esc(mv.san)}</b> is the engine's choice too. <span class="muted">(${evalTxt})</span>`;
			else if (t)
				text = `<b>${num} ${esc(mv.san)}</b> was ${WORD[t]}. <span class="muted">(${evalTxt})</span><br>Better was <b>${esc(bestSan ?? "?")}</b>${before.pv?.length > 1 ? `, for example ${esc(sanLine(fenBefore, before.pv, 5).join(" "))}` : ""}.`;
			else
				text = `<b>${num} ${esc(mv.san)}</b> is fine. <span class="muted">(${evalTxt}${bestSan ? `; the engine liked ${esc(bestSan)}` : ""})</span>`;
		}
		d.innerHTML = `<p>${text}</p><div class="row">
			<button class="btn sm" data-best ${!before ? "disabled" : ""}>${icon("hint")}${showBest ? "Hide" : "Show"} the best move</button>
			<button class="btn sm" data-explain>${icon("ask")}Explain with ${esc(bot.name)}</button>
			<button class="btn sm" data-from>${icon("play")}Play on from here</button></div>`;
		d.querySelector("[data-best]").onclick = () => {
			showBest = !showBest;
			draw();
		};
		d.querySelector("[data-explain]").onclick = () => explain(mv, who);
		d.querySelector("[data-from]").onclick = () =>
			app.go("play", {
				startFen: game.at(cur).fen(),
				you: game.at(cur).turn,
				setup: false,
			});
		void who;
	}

	async function draw() {
		const g = game.at(cur);
		const arrows = [];
		if (showBest && cur > 0 && evals[cur - 1]?.best) {
			const b = evals[cur - 1].best;
			arrows.push({ from: b.slice(0, 2), to: b.slice(2, 4), kind: "best" });
		}
		const marks = {};
		const t = cur > 0 ? tagAt(cur) : null;
		if (t === "blunder" || t === "mistake")
			marks[game.history[cur - 1].to] = "bad";
		await board.set({ ...stateOf(g), movable: null, arrows, marks });
		renderMoves();
		renderGraph();
		renderDetail();
	}

	let lastCur = cur;
	function go(n) {
		const next = Math.max(0, Math.min(plies, n));
		if (next === cur) return;
		const forward = next === cur + 1;
		cur = next;
		showBest = false;
		if (forward) {
			const mv = game.history[cur - 1];
			play(mv.captured ? "capture" : mv.check ? "check" : "move");
		}
		lastCur = cur;
		draw();
	}
	void lastCur;

	async function explain(mv, who) {
		const before = evals[cur - 1];
		const after = evals[cur];
		const fenBefore = game.at(cur - 1).fen();
		const t = tagAt(cur);
		const num = `${Math.ceil(cur / 2)}${mv.colour === "w" ? "." : "..."}`;
		const question = t
			? `Why was ${num} ${mv.san} ${WORD[t]}?`
			: `Can you explain ${num} ${mv.san}?`;
		const context = [
			`The person is reviewing a finished chess game in the Chess app, which is open beside this conversation. ${who === "You" ? "The move is theirs." : "The move is their opponent's."} They played ${you === "w" ? "White" : "Black"}${bot ? ` against you (${bot.name})` : ""}.`,
			`The game (PGN): ${game.pgn().split("\n\n")[1]?.trim()}`,
			`Position before the move (FEN): ${fenBefore}`,
			`Move played: ${num} ${mv.san}.`,
			before
				? `Engine before the move: ${scoreText(before.score)} for White; best was ${sanLine(fenBefore, [before.best])[0] ?? "?"} (line: ${sanLine(fenBefore, before.pv ?? [], 6).join(" ")}).`
				: "",
			after
				? `Engine after the move: ${scoreText(after.score)} for White${after.pv?.length ? `; the best reply line is ${sanLine(game.at(cur).fen(), after.pv, 6).join(" ")}` : ""}.`
				: "",
			"Explain in plain words what the move did, what it missed and why the better move is better. Keep it short, moves in SAN, and talk like a friendly coach.",
		]
			.filter(Boolean)
			.join("\n");
		await app.ask(question, context);
	}

	await draw();

	// analyse every position, the current one first, then from the start
	(async () => {
		const progress = side.querySelector("[data-progress]");
		const order = [...Array(plies + 1).keys()];
		let done = 0;
		const ms = plies > 120 ? 180 : plies > 70 ? 250 : 350;
		for (const n of order) {
			if (!alive) return;
			if (game.at(n).over()) {
				// a finished position: mate, or a draw
				const o = game.at(n).over();
				evals[n] = {
					score: o.result === "1-0" ? 30000 : o.result === "0-1" ? -30000 : 0,
					best: null,
					pv: [],
				};
			} else {
				try {
					const r = await app.engine.analyse({
						fen: game.startFen,
						moves: game.history.slice(0, n).map((m) => m.uci),
						ms,
					});
					evals[n] = { score: r.score, best: r.move, pv: r.pv };
				} catch (error) {
					if (error?.cancelled || !alive) return;
					toast(error?.message ?? String(error), "error");
					return;
				}
			}
			done++;
			if (progress)
				progress.innerHTML =
					done <= plies
						? `<div class="bar"><i style="width:${((done / (plies + 1)) * 100).toFixed(1)}%"></i></div><span class="muted small">Analysing the game… ${done} of ${plies + 1}</span>`
						: "";
			if (done % 4 === 0 || done === plies + 1) {
				renderAccuracy();
				renderGraph();
				renderMoves();
				if (Math.abs(n - cur) <= 1) renderDetail();
			}
		}
		if (progress) progress.innerHTML = "";
		renderAccuracy();
		renderDetail();
		draw();
	})();

	const onKey = (e) => {
		if (e.target.closest?.("input, textarea")) return;
		if (e.key === "ArrowLeft") go(cur - 1);
		else if (e.key === "ArrowRight") go(cur + 1);
		else if (e.key === "ArrowUp") go(0);
		else if (e.key === "ArrowDown") go(plies);
		else return;
		e.preventDefault();
	};
	document.addEventListener("keydown", onKey);
	renderAccuracy();
	void faceSvg;

	return {
		destroy() {
			alive = false;
			document.removeEventListener("keydown", onKey);
			board.destroy();
		},
	};
}
