/*
 * WATCH: a game between two players that are not you, on the big board. Your Bots, or the engine at
 * any level, in any pairing: Bot against Bot, your Bot against Easy, Expert against Beginner. Speed,
 * pause, their remarks in bubbles, and the finished game saved and ready for a review.
 */
import { moveHint, stateOf } from "./boardview.js";
import { LEVELS, openingName } from "./engine.js";
import { runMatch, SPEEDS, sideName } from "./match.js";
import { moveSound, play } from "./sound.js";
import { saveGame } from "./store.js";
import { esc, faceSvg, icon } from "./ui.js";

/** The <option>s for one side: the engine at each level, then the Bots (when they can play). */
export function sideOptions(app, selected) {
	const engine = Object.keys(LEVELS).map(
		(id) =>
			`<option value="engine:${id}" ${selected === `engine:${id}` ? "selected" : ""}>Engine, ${LEVELS[id].label}</option>`,
	);
	const bots = app.features.includes("think")
		? app.bots.map(
				(b) =>
					`<option value="${esc(b.id)}" ${selected === b.id ? "selected" : ""}>${esc(b.name)}</option>`,
			)
		: [];
	return `<optgroup label="Chess engine">${engine.join("")}</optgroup>${bots.length ? `<optgroup label="Your Bots">${bots.join("")}</optgroup>` : ""}`;
}

const faceOf = (side, mood = "idle") =>
	side.kind === "bot"
		? faceSvg(side.bot, mood)
		: `<span class="engine-face">${icon("knight")}</span>`;

export function startWatch({
	app,
	board,
	side: panel,
	stage,
	white,
	black,
	speed = "normal",
	onExit,
	onReview,
}) {
	const sides = { w: white, b: black };
	let state = "playing";
	let pgn = null;
	let savedPath = null;
	const bubbleTimers = {};

	board.orient("w");
	panel.innerHTML = `${seat("b")}<div class="bubble" data-bubble="b"></div>
		<div class="opening" data-opening></div>
		<div class="moves" data-moves></div>
		<div class="controls watch-controls">
			<button class="btn" data-pause>${icon("pause")}Pause</button>
			<div class="seg" role="group" aria-label="Speed">${Object.keys(SPEEDS)
				.map(
					(s) =>
						`<button data-speed="${s}" aria-pressed="${s === speed}">${s[0].toUpperCase()}${s.slice(1)}</button>`,
				)
				.join("")}</div>
			<button class="btn" data-stop>${icon("x")}Stop</button>
		</div>
		<div class="bubble" data-bubble="w"></div>${seat("w")}`;

	function seat(colour) {
		const s = sides[colour];
		return `<div class="seat" data-seat="${colour}"><span class="face" data-face="${colour}">${faceOf(s)}</span><div class="who"><b>${esc(sideName(s))}</b><span>${colour === "w" ? "White" : "Black"}<span data-think="${colour}"></span></span></div></div>`;
	}

	const sync = (move = null) => {
		const g = match.game;
		board.set({ ...stateOf(g), movable: null, arrows: [], move });
		const h = g.history;
		let html = "";
		for (let i = 0; i < h.length; i += 2)
			html += `<span class="n">${i / 2 + 1}.</span><button class="${i === h.length - 1 ? "cur" : ""}">${esc(h[i].san)}</button>${h[i + 1] ? `<button class="${i + 1 === h.length - 1 ? "cur" : ""}">${esc(h[i + 1].san)}</button>` : "<span></span>"}`;
		const movesEl = panel.querySelector("[data-moves]");
		movesEl.innerHTML =
			html || `<div class="empty">The game is about to start.</div>`;
		movesEl.scrollTop = movesEl.scrollHeight;
		const name = openingName(g);
		panel.querySelector("[data-opening]").innerHTML = name
			? `Opening: <b>${esc(name)}</b>`
			: "";
	};

	const say = (colour, text, mood = "playful") => {
		const b = panel.querySelector(`[data-bubble="${colour}"]`);
		if (!b) return;
		b.textContent = text;
		b.classList.add("show");
		const f = panel.querySelector(`[data-face="${colour}"]`);
		if (f) f.innerHTML = faceOf(sides[colour], mood);
		clearTimeout(bubbleTimers[colour]);
		bubbleTimers[colour] = setTimeout(() => {
			b.classList.remove("show");
			if (f) f.innerHTML = faceOf(sides[colour]);
		}, 4500);
	};

	const match = runMatch({
		white,
		black,
		engine: app.engine,
		speed,
		onMove: (mv) => {
			play(moveSound(mv, { check: mv.check }));
			sync(moveHint(mv));
		},
		onSay: say,
		onThinking: (colour, on) => {
			const t = panel.querySelector(`[data-think="${colour}"]`);
			if (t)
				t.innerHTML = on
					? ` · thinking<span class="thinking-dots"><i></i><i></i><i></i></span>`
					: "";
		},
		onEnd: async (over, game) => {
			state = "over";
			const headers = {
				Event: "DeepBot Chess (watched)",
				White: sideName(white),
				Black: sideName(black),
				Termination: over.reason,
			};
			pgn = game.pgn({ headers });
			savedPath = await saveGame(pgn, {
				level: "watched",
				opponent: `${sideName(white)}-vs-${sideName(black)}`,
			});
			const winner =
				over.result === "1-0" ? "w" : over.result === "0-1" ? "b" : null;
			play(winner ? "win" : "draw");
			if (winner) {
				say(winner, "Good game!", "celebrate");
				say(winner === "w" ? "b" : "w", "Well played.", "sad");
			}
			const div = document.createElement("div");
			div.className = "over";
			div.innerHTML = `<div class="card"><div class="face">${winner ? faceOf(sides[winner], "celebrate") : faceOf(white, "neutral")}</div><h2>${winner ? `${esc(sideName(sides[winner]))} won` : "A draw"}</h2><p>${esc(over.reason[0].toUpperCase() + over.reason.slice(1))}.</p>
				<div class="row"><button class="btn primary" data-review>${icon("chart")}Review the game</button><button class="btn" data-again>${icon("refresh")}Watch again</button><button class="btn ghost" data-close>Look at the board</button></div></div>`;
			stage.appendChild(div);
			div.querySelector("[data-review]").onclick = () =>
				onReview?.({ pgn, path: savedPath });
			div.querySelector("[data-again]").onclick = () => {
				div.remove();
				onExit?.({ again: true });
			};
			div.querySelector("[data-close]").onclick = () => div.remove();
			const controls = panel.querySelector(".watch-controls");
			controls.innerHTML = `<button class="btn primary" data-review>${icon("chart")}Review the game</button><button class="btn" data-new>New game</button>`;
			controls.querySelector("[data-review]").onclick = () =>
				onReview?.({ pgn, path: savedPath });
			controls.querySelector("[data-new]").onclick = () => onExit?.({});
		},
	});

	const pauseBtn = panel.querySelector("[data-pause]");
	pauseBtn.onclick = () => {
		if (match.paused) match.resume();
		else match.pause();
		pauseBtn.innerHTML = match.paused
			? `${icon("play")}Resume`
			: `${icon("pause")}Pause`;
	};
	for (const b of panel.querySelectorAll("[data-speed]"))
		b.onclick = () => {
			match.setSpeed(b.dataset.speed);
			for (const x of panel.querySelectorAll("[data-speed]"))
				x.setAttribute("aria-pressed", String(x === b));
		};
	panel.querySelector("[data-stop]").onclick = () => {
		match.stop();
		onExit?.({});
	};
	sync();

	return {
		stop() {
			if (state === "playing") match.stop();
			for (const t of Object.values(bubbleTimers)) clearTimeout(t);
		},
	};
}
