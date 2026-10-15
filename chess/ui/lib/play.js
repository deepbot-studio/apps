/*
 * PLAY: pick the opponent (the chess engine at a level, or one of your Bots choosing its own moves
 * through your model), your colour and a clock; then the board, the opponent's face and remarks,
 * the moves, hints, takebacks, a draw offer, resigning, asking your Bot about the position beside
 * the page, and the end of the game with a way into the review. "Watch a game" sets up a game
 * between two players that are not you (watch.js).
 * The game in progress is kept, so closing the page does not lose it.
 */
import { destsOf, moveHint, stateOf } from "./boardview.js";
import { judge, say } from "./coach.js";
import { isMate, LEVELS, openingName, scoreText } from "./engine.js";
import { parseSide } from "./match.js";
import { pieceSvg } from "./pieces.js";
import { Game, START } from "./rules.js";
import { moveSound, play } from "./sound.js";
import { load, save, saveGame } from "./store.js";
import { armed, clockText, esc, faceSvg, icon, sleep, toast } from "./ui.js";
import { sideOptions, startWatch } from "./watch.js";

export const TIMES = [
	{ id: "none", label: "No clock" },
	{ id: "3+2", label: "3 + 2", base: 3, inc: 2 },
	{ id: "5+0", label: "5 min", base: 5, inc: 0 },
	{ id: "10+0", label: "10 min", base: 10, inc: 0 },
	{ id: "15+10", label: "15 + 10", base: 15, inc: 10 },
	{ id: "30+0", label: "30 min", base: 30, inc: 0 },
];
const LEVEL_IDS = Object.keys(LEVELS);
const REASONS = {
	checkmate: "Checkmate.",
	stalemate: "Stalemate: no legal move, and no check.",
	"insufficient material": "Neither side has enough left to checkmate.",
	"fifty-move rule": "Fifty moves without a capture or a pawn move.",
	"threefold repetition": "The same position, three times.",
};

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material each side is up, from the pieces on the board. */
function materialDiff(game) {
	let w = 0;
	let b = 0;
	for (const row of game.board())
		for (const p of row)
			if (p?.colour === "w") w += VALUE[p.type];
			else if (p) b += VALUE[p.type];
	return w - b;
}

/** UCI moves to SAN from a position (for the engine's lines). */
function sanLine(fen, ucis, max = 8) {
	const g = new Game(fen);
	const out = [];
	for (const u of ucis.slice(0, max)) {
		const mv = g.move(u);
		if (!mv) break;
		out.push(mv.san);
	}
	return out;
}

export async function mountPlay(app, el, params = {}) {
	el.innerHTML = `<div class="play"><div class="stage"><div class="stage-tools"></div></div><aside class="side"></aside></div>`;
	const stage = el.querySelector(".stage");
	const side = el.querySelector(".side");
	const tools = el.querySelector(".stage-tools");
	let G = null; // the game being played
	let viewPly = null; // looking back at an earlier position
	let alive = true;
	let tickTimer = 0;
	let bubbleTimer = 0;
	let moodTimer = 0;
	let promoEl = null;

	const board = await app.board(stage, {
		orientation: "w",
		onMove: (m) => onPlayerMove(m),
	});
	if (!alive) return { destroy() {} };

	tools.innerHTML = `<button class="iconbtn" data-flip title="Turn the board" aria-label="Turn the board">${icon("flip")}</button><button class="iconbtn" data-reset title="Reset the view" aria-label="Reset the view">${icon("view")}</button>`;
	tools.querySelector("[data-flip]").onclick = () => board.flip();
	tools.querySelector("[data-reset]").onclick = () => board.resetView();
	const syncTools = () => {
		tools.querySelector("[data-reset]").hidden = board.mode !== "3d";
	};
	syncTools();

	/* ------------------------------------------------------------------ setting up a game */

	const picks = {
		opponent: app.bot().id,
		mover:
			app.settings.mover === "bot" && app.features.includes("think")
				? "bot"
				: "engine",
		level: LEVELS[app.settings.level] ? app.settings.level : "medium",
		colour: app.settings.colour ?? "w",
		time: TIMES.some((t) => t.id === app.settings.time)
			? app.settings.time
			: "none",
		mode: app.settings.mode === "watch" ? "watch" : "play",
		white: app.settings.watchWhite ?? null,
		black: app.settings.watchBlack ?? "engine:medium",
		speed: app.settings.watchSpeed ?? "normal",
	};
	let watching = null;

	const modeToggle = () =>
		`<div class="seg mode-seg" role="group" aria-label="Mode"><button data-mode="play" aria-pressed="${picks.mode === "play"}">${icon("knight")}Play</button><button data-mode="watch" aria-pressed="${picks.mode === "watch"}">${icon("view")}Watch a game</button></div>`;
	const wireMode = () => {
		for (const b of side.querySelectorAll("[data-mode]"))
			b.onclick = () => {
				picks.mode = b.dataset.mode;
				app.settings.mode = picks.mode;
				app.saveSettings();
				showSetup();
			};
	};

	/** Watch: pick both players (the engine at a level, or a Bot), and the speed. */
	function showWatchSetup() {
		const canThink = app.features.includes("think") && app.bots.length;
		const valid = (v) =>
			v &&
			(v.startsWith("engine:") ||
				(canThink && app.bots.some((b) => b.id === v)));
		if (!valid(picks.white))
			picks.white = canThink ? companion().id : "engine:hard";
		if (!valid(picks.black)) picks.black = "engine:medium";
		side.innerHTML = `<div class="setup">
			${modeToggle()}
			<div><h2>Watch a game</h2><p class="lead">${canThink ? "Your Bots against each other, a Bot against the engine, or the engine against itself at two levels." : "The engine against itself, at two levels."}</p></div>
			<div class="field"><label for="w-white">White</label><select id="w-white" class="select" data-side="white">${sideOptions(app, picks.white)}</select></div>
			<div class="field"><label for="w-black">Black</label><select id="w-black" class="select" data-side="black">${sideOptions(app, picks.black)}</select></div>
			${canThink ? `<p class="level-about">A Bot chooses each move with your AI model, so a game between Bots takes a while and uses your model's tokens. All your Bots share that model: two Bots are one model playing itself, under two names.</p>` : ""}
			<div class="field"><span class="label">Speed</span><div class="chips">${["slow", "normal", "fast"].map((sp) => `<button class="chip" data-speed="${sp}" aria-pressed="${picks.speed === sp}">${sp[0].toUpperCase()}${sp.slice(1)}</button>`).join("")}</div></div>
			<div class="go"><button class="btn primary big" data-watch>${icon("play")}Start watching</button></div>
		</div>`;
		wireMode();
		const remember = () => {
			app.settings.watchWhite = picks.white;
			app.settings.watchBlack = picks.black;
			app.settings.watchSpeed = picks.speed;
			app.saveSettings();
		};
		for (const sel of side.querySelectorAll("[data-side]"))
			sel.onchange = () => {
				picks[sel.dataset.side] = sel.value;
				remember();
			};
		for (const b of side.querySelectorAll("[data-speed]"))
			b.onclick = () => {
				picks.speed = b.dataset.speed;
				remember();
				for (const x of side.querySelectorAll("[data-speed]"))
					x.setAttribute("aria-pressed", String(x === b));
			};
		side.querySelector("[data-watch]").onclick = () => {
			remember();
			beginWatch();
		};
	}

	function beginWatch() {
		const white = parseSide(
			picks.white,
			app.bots,
			app.features.includes("think"),
		);
		const black = parseSide(
			picks.black,
			app.bots,
			app.features.includes("think"),
		);
		if (!white || !black) return toast("Choose both players.");
		stage.querySelector(".over")?.remove();
		watching?.stop();
		watching = startWatch({
			app,
			board,
			side,
			stage,
			white,
			black,
			speed: picks.speed,
			onExit: ({ again } = {}) => {
				watching?.stop();
				watching = null;
				if (again) beginWatch();
				else showSetup();
			},
			onReview: ({ pgn, path }) =>
				app.go("review", { pgn, path, from: "play" }),
		});
	}

	/** The Bot at the table when the engine plays: the one beside the page, or the first. */
	const companion = () =>
		app.bots.find((b) => b.id === app.botId) ?? app.bots[0] ?? app.bot();

	async function showSetup() {
		G = null;
		stopClock();
		watching?.stop();
		watching = null;
		stage.querySelector(".over")?.remove();
		if (picks.mode === "watch") {
			board.orient("w");
			await board.set({ ...stateOf(new Game()), movable: null, arrows: [] });
			if (alive) showWatchSetup();
			return;
		}
		const saved = await load("current", null);
		if (!alive) return;
		board.orient(picks.colour === "b" ? "b" : "w");
		await board.set({ ...stateOf(new Game()), movable: null, arrows: [] });
		const bots = app.bots;
		const bot = bots.find((b) => b.id === picks.opponent) ?? app.bot();
		const name = bot.name;
		const level = LEVELS[picks.level];
		const canThink = app.features.includes("think");
		side.innerHTML = `<div class="setup">
			${modeToggle()}
			<div><h2>${picks.mover === "bot" ? `Play ${esc(name)}` : "Play chess"}</h2><p class="lead">${picks.mover === "bot" ? `${esc(name)} chooses its own moves.` : "A game against the chess engine, at the level you choose."}</p></div>
			${saved?.moves?.length ? resumeCard(saved) : ""}
			<div class="field"><span class="label">Opponent</span><div class="seg" role="group">
				<button data-mover="engine" aria-pressed="${picks.mover === "engine"}">${icon("knight")}Chess engine</button>
				<button data-mover="bot" aria-pressed="${picks.mover === "bot"}" ${canThink && bots.length ? "" : "disabled"}>${icon("ask")}${bots.length === 1 ? esc(name) : "One of your Bots"}</button></div>
				<p class="level-about">${!canThink || !bots.length ? "Playing against one of your Bots needs the newest DeepBot." : picks.mover === "bot" ? "The Bot reads the board and chooses with your AI model. Slower, and it plays like a language model: inventive, sometimes careless. Uses your model's tokens." : "The engine plays at the level you pick below."}</p></div>
			${
				picks.mover === "bot" && bots.length > 1
					? `<div class="field"><span class="label">Which Bot</span><div class="opponents">${bots
							.map(
								(b) =>
									`<button class="opp" data-opp="${esc(b.id)}" aria-pressed="${b.id === bot.id}"><span class="face">${faceSvg(b, "idle")}</span>${esc(b.name)}</button>`,
							)
							.join("")}</div></div>`
					: ""
			}
			<div class="field" ${picks.mover === "bot" ? "hidden" : ""}><span class="label">Level</span><div class="levels" role="group">${LEVEL_IDS.map(
				(id) =>
					`<button data-level="${id}" aria-pressed="${picks.level === id}">${LEVELS[id].label}</button>`,
			).join("")}</div><p class="level-about">${esc(level.about)}</p></div>
			<div class="field"><span class="label">You play</span><div class="colours" role="group">
				<button data-colour="w" aria-pressed="${picks.colour === "w"}">${pieceSvg("k", "w")}White</button>
				<button data-colour="random" aria-pressed="${picks.colour === "random"}"><span class="split-king">${pieceSvg("k", "w")}${pieceSvg("k", "b")}</span>Random</button>
				<button data-colour="b" aria-pressed="${picks.colour === "b"}">${pieceSvg("k", "b")}Black</button></div></div>
			<div class="field"><span class="label">Clock</span><div class="chips">${TIMES.map(
				(t) =>
					`<button class="chip" data-time="${t.id}" aria-pressed="${picks.time === t.id}">${t.label}</button>`,
			).join("")}</div></div>
			<div class="go"><button class="btn primary big" data-start>${icon("play")}Start the game</button>
			${!app.bots.length && window.deepbot ? `<p class="note">No Bot here yet, so you play DeepBot's engine.</p>` : ""}</div>
		</div>`;
		const remember = () => {
			app.settings.level = picks.level;
			app.settings.colour = picks.colour;
			app.settings.time = picks.time;
			app.settings.mover = picks.mover;
			app.settings.opponent = picks.opponent;
			app.saveSettings();
		};
		for (const b of side.querySelectorAll("[data-opp]"))
			b.onclick = () => {
				picks.opponent = b.dataset.opp;
				remember();
				showSetup();
			};
		for (const b of side.querySelectorAll("[data-mover]"))
			b.onclick = () => {
				picks.mover = b.dataset.mover;
				remember();
				showSetup();
			};
		for (const b of side.querySelectorAll("[data-level]"))
			b.onclick = () => {
				picks.level = b.dataset.level;
				remember();
				showSetup();
			};
		for (const b of side.querySelectorAll("[data-colour]"))
			b.onclick = () => {
				picks.colour = b.dataset.colour;
				remember();
				board.orient(picks.colour === "b" ? "b" : "w");
				for (const x of side.querySelectorAll("[data-colour]"))
					x.setAttribute("aria-pressed", String(x === b));
			};
		for (const b of side.querySelectorAll("[data-time]"))
			b.onclick = () => {
				picks.time = b.dataset.time;
				remember();
				for (const x of side.querySelectorAll("[data-time]"))
					x.setAttribute("aria-pressed", String(x === b));
			};
		side.querySelector("[data-start]").onclick = () => {
			remember();
			startGame();
		};
		wireMode();
		const resume = side.querySelector("[data-resume]");
		if (resume) resume.onclick = () => resumeGame(saved);
		const drop = side.querySelector("[data-drop]");
		if (drop)
			armed(drop, "Sure?", () => {
				save("current", null, 0);
				showSetup();
			});
	}

	function resumeCard(saved) {
		const bot = app.bots.find((b) => b.id === saved.opponent) ?? app.bot();
		const engine = saved.mover !== "bot";
		const moves = Math.ceil((saved.moves?.length ?? 0) / 2);
		const face = engine
			? `<span class="engine-face">${icon("knight")}</span>`
			: faceSvg(bot, "playful");
		const against = engine
			? `the chess engine, ${esc(LEVELS[saved.level]?.label ?? "")}`
			: esc(bot.name);
		return `<div class="resume"><span class="face">${face}</span>
			<div class="grow"><b>A game in progress</b><div class="note">Against ${against}, ${moves} ${moves === 1 ? "move" : "moves"} in.</div></div>
			<div class="resume-actions"><button class="btn sm primary" data-resume>${icon("play")}Continue</button><button class="btn sm ghost" data-drop title="Abandon it">${icon("x")}Abandon</button></div></div>`;
	}

	/* ------------------------------------------------------------------ the game */

	function newState({ you, level, mover, opponent, time, startFen = START }) {
		const t = TIMES.find((x) => x.id === time) ?? TIMES[0];
		const bot = app.bots.find((b) => b.id === opponent) ?? app.bot();
		return {
			game: new Game(startFen),
			you,
			level,
			mover,
			bot,
			time: t,
			clock: t.base
				? {
						w: t.base * 60_000,
						b: t.base * 60_000,
						inc: (t.inc ?? 0) * 1000,
						since: 0,
						started: false,
					}
				: null,
			thinking: false,
			over: null,
			lastYouScore: null,
			hints: 0,
			takebacks: 0,
			arrows: [],
			mood: "idle",
			saidAt: 0,
			started: new Date().toISOString(),
		};
	}

	async function startGame(from = null) {
		const you =
			from?.you ??
			(picks.colour === "random"
				? Math.random() < 0.5
					? "w"
					: "b"
				: picks.colour);
		G = newState({
			you,
			level: picks.level,
			mover: picks.mover,
			opponent: picks.mover === "bot" ? picks.opponent : companion().id,
			time: from ? "none" : picks.time,
			startFen: from?.fen ?? START,
		});
		viewPly = null;
		board.orient(you);
		renderGame();
		await board.set({ ...stateOf(G.game), arrows: [] });
		play("start");
		const line = say(you === "b" ? "startBlack" : "start");
		if (line) speak(line.text, line.mood);
		persist();
		await sync();
		if (G.game.turn !== G.you) botMove();
	}

	async function resumeGame(saved) {
		try {
			G = newState({
				you: saved.you,
				level: saved.level,
				mover:
					saved.mover === "bot" && app.features.includes("think")
						? "bot"
						: "engine",
				opponent: saved.opponent,
				time: saved.time,
				startFen: saved.startFen || START,
			});
			for (const u of saved.moves ?? [])
				if (!G.game.move(u))
					throw new Error(`The saved move ${u} does not fit.`);
			if (G.clock && saved.clock) {
				G.clock.w = saved.clock.w;
				G.clock.b = saved.clock.b;
				G.clock.started = G.game.history.length > 0;
			}
			G.hints = saved.hints ?? 0;
			G.takebacks = saved.takebacks ?? 0;
			G.started = saved.started ?? G.started;
		} catch (error) {
			toast(`That game could not be continued: ${error.message}`, "error");
			save("current", null, 0);
			return showSetup();
		}
		board.orient(G.you);
		renderGame();
		await sync();
		const over = G.game.over();
		if (over) return finish(over);
		startClock();
		if (G.game.turn !== G.you) botMove();
	}

	function persist() {
		if (!G) return;
		if (G.over) {
			save("current", null, 0);
			return;
		}
		save("current", {
			startFen: G.game.startFen,
			moves: G.game.history.map((h) => h.uci),
			you: G.you,
			level: G.level,
			mover: G.mover,
			opponent: G.bot.id,
			time: G.time.id,
			clock: G.clock ? { w: G.clock.w, b: G.clock.b } : null,
			hints: G.hints,
			takebacks: G.takebacks,
			started: G.started,
		});
	}

	/* ------------------------------------------------------------------ drawing the side */

	/** Who sits across the board: the engine at its level, or the Bot that picks its own moves. */
	const opponentName = () => (G.mover === "bot" ? G.bot.name : "Chess engine");
	const opponentFace = (mood) =>
		G.mover === "bot"
			? faceSvg(G.bot, mood)
			: `<span class="engine-face">${icon("knight")}</span>`;

	function seat(who) {
		if (!G) return "";
		const bot = who === "bot";
		const colour = bot ? (G.you === "w" ? "b" : "w") : G.you;
		const diff = materialDiff(G.game) * (colour === "w" ? 1 : -1);
		const sub = bot
			? G.mover === "bot"
				? "Picks its own moves"
				: LEVELS[G.level].label
			: colour === "w"
				? "White"
				: "Black";
		const face = bot
			? `<span class="face" data-face>${opponentFace(G.mood)}</span>`
			: `<span class="you-dot">${pieceSvg("k", colour)}</span>`;
		const clock = G.clock
			? `<div class="clock" data-clock="${colour}">${clockText(G.clock[colour])}</div>`
			: "";
		return `<div class="seat" data-seat="${who}">${face}<div class="who"><b>${bot ? esc(opponentName()) : "You"}</b><span>${esc(sub)}${bot ? `<span data-think></span>` : ""}</span></div><span class="material">${diff > 0 ? `+${diff}` : ""}</span>${clock}</div>`;
	}

	function renderGame() {
		const noClock = !G.clock;
		side.innerHTML = `${seat("bot")}<div class="bubble" data-bubble></div>
			<div class="opening" data-opening></div>
			<div class="moves" data-moves></div>
			<div class="browse"><button class="iconbtn" data-nav="first" aria-label="First position">${icon("first")}</button><button class="iconbtn" data-nav="prev" aria-label="Previous move">${icon("prev")}</button><button class="iconbtn" data-nav="next" aria-label="Next move">${icon("next")}</button><button class="iconbtn" data-nav="last" aria-label="Current position">${icon("last")}</button><span class="grow"></span><button class="iconbtn" data-pgn title="Copy the game (PGN)" aria-label="Copy the game as PGN">${icon("copy")}</button></div>
			<div class="controls" data-controls>
				<button class="btn" data-hint>${icon("hint")}Hint</button>
				${noClock ? `<button class="btn" data-takeback>${icon("undo")}Take back</button>` : ""}
				<button class="btn" data-ask>${icon("ask")}Ask ${esc(G.bot.name)}</button>
				<button class="btn" data-draw>${icon("draw")}Offer a draw</button>
				<button class="btn" data-resign>${icon("flag")}Resign</button>
				<button class="btn" data-leave>${icon("refresh")}New game</button>
			</div>
			<div class="askbox" data-askbox><form><input name="q" placeholder="Ask ${esc(G.bot.name)} about the position…" autocomplete="off" aria-label="Your question"><button class="btn primary" type="submit">Ask</button></form>
				<div class="chips">${["What's the plan here?", "Was my last move good?", "What are you threatening?", "Explain this opening"].map((q) => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>
			${seat("you")}`;
		side.querySelector("[data-hint]").onclick = hint;
		side.querySelector("[data-takeback]")?.addEventListener("click", takeback);
		side.querySelector("[data-ask]").onclick = () => {
			const box = side.querySelector("[data-askbox]");
			box.classList.toggle("open");
			if (box.classList.contains("open")) box.querySelector("input").focus();
		};
		side.querySelector("[data-askbox] form").onsubmit = (e) => {
			e.preventDefault();
			const input = e.target.q;
			const q = input.value.trim();
			if (!q) return;
			input.value = "";
			askBot(q);
		};
		for (const c of side.querySelectorAll("[data-q]"))
			c.onclick = () => askBot(c.dataset.q);
		side.querySelector("[data-draw]").onclick = offerDraw;
		armed(side.querySelector("[data-resign]"), "Resign?", resign);
		// a new game from the middle of one: this one is left unfinished, not lost
		armed(side.querySelector("[data-leave]"), "Leave this game?", () => {
			app.engine.cancel();
			stopClock();
			G = null;
			save("current", null, 0);
			showSetup();
		});
		for (const b of side.querySelectorAll("[data-nav]"))
			b.onclick = () => nav(b.dataset.nav);
		side.querySelector("[data-pgn]").onclick = async () => {
			try {
				await navigator.clipboard.writeText(pgnText());
				toast("The game is copied as PGN.");
			} catch {
				toast("Copying is not allowed here.");
			}
		};
		updateSide();
	}

	function updateSide() {
		if (!G) return;
		const h = G.game.history;
		const movesEl = side.querySelector("[data-moves]");
		if (movesEl) {
			const startBlack = G.game.startFen.split(" ")[1] === "b";
			let html = "";
			const cur = viewPly ?? h.length;
			if (!h.length)
				html = `<div class="empty">${G.game.turn === G.you ? "Your move." : `${esc(opponentName())} moves first.`}</div>`;
			let num = Number(G.game.startFen.split(" ")[5]) || 1;
			let i = 0;
			if (startBlack && h.length) {
				html += `<span class="n">${num}.</span><span></span>${moveBtn(0, cur)}`;
				i = 1;
				num++;
			}
			for (; i < h.length; i += 2) {
				html += `<span class="n">${num}.</span>${moveBtn(i, cur)}${h[i + 1] ? moveBtn(i + 1, cur) : "<span></span>"}`;
				num++;
			}
			movesEl.innerHTML = html;
			for (const b of movesEl.querySelectorAll("[data-ply]"))
				b.onclick = () => showPly(Number(b.dataset.ply));
			const active = movesEl.querySelector(".cur");
			if (active) active.scrollIntoView({ block: "nearest" });
			else movesEl.scrollTop = movesEl.scrollHeight;
		}
		const opening = side.querySelector("[data-opening]");
		if (opening) {
			const name = openingName(G.game);
			opening.innerHTML = name ? `Opening: <b>${esc(name)}</b>` : "";
		}
		for (const who of ["bot", "you"]) {
			const el2 = side.querySelector(`[data-seat="${who}"] .material`);
			if (el2) {
				const colour = who === "bot" ? (G.you === "w" ? "b" : "w") : G.you;
				const diff = materialDiff(G.game) * (colour === "w" ? 1 : -1);
				el2.textContent = diff > 0 ? `+${diff}` : "";
			}
		}
		const busy = G.thinking || Boolean(G.over);
		const yourTurn = G.game.turn === G.you;
		const set = (sel, disabled) => {
			const b = side.querySelector(sel);
			if (b) b.disabled = disabled;
		};
		set("[data-hint]", busy || !yourTurn || viewPly !== null);
		set(
			"[data-takeback]",
			G.thinking || !G.game.history.some((m) => m.colour === G.you),
		);
		set("[data-draw]", busy || h.length < 2);
		set("[data-resign]", busy || h.length < 1);
		const think = side.querySelector("[data-think]");
		if (think)
			think.innerHTML = G.thinking
				? ` · thinking<span class="thinking-dots"><i></i><i></i><i></i></span>`
				: "";
		updateClocks();
		const controls = side.querySelector("[data-controls]");
		if (controls && G.over && !controls.dataset.over) {
			controls.dataset.over = "1";
			controls.innerHTML = `<button class="btn primary" data-review>${icon("chart")}Review the game</button><button class="btn" data-rematch>${icon("refresh")}Rematch</button><button class="btn" data-new>New game</button>${!G.clock ? `<button class="btn" data-takeback>${icon("undo")}Take back</button>` : ""}`;
			wireOver(controls);
		}
	}

	const tagHtml = () => "";
	function moveBtn(i, cur) {
		const mv = G.game.history[i];
		return `<button data-ply="${i + 1}" class="${cur === i + 1 ? "cur" : ""}">${esc(mv.san)}${tagHtml(i)}</button>`;
	}

	/** Put the board in line with the game (or with the position being looked at). */
	async function sync(move = null) {
		if (!G) return;
		if (viewPly !== null) {
			const g = G.game.at(viewPly);
			await board.set({ ...stateOf(g), movable: null, arrows: [], move });
		} else {
			const canMove =
				!G.over && !G.thinking && G.game.turn === G.you ? G.you : null;
			await board.set({
				...stateOf(G.game, { canMove, arrows: G.arrows }),
				move,
			});
		}
		updateSide();
		renderViewing();
	}

	function renderViewing() {
		stage.querySelector(".viewing")?.remove();
		if (viewPly === null || !G) return;
		const div = document.createElement("div");
		div.className = "viewing";
		div.innerHTML = `<span>Looking at move ${Math.ceil(viewPly / 2) || 0}${viewPly % 2 ? "" : "…"}</span><button>Back to the game</button>`;
		div.querySelector("button").onclick = () => showPly(null);
		stage.appendChild(div);
	}

	function showPly(n) {
		if (!G) return;
		viewPly = n === null || n >= G.game.history.length ? null : Math.max(0, n);
		sync();
	}
	function nav(where) {
		if (!G) return;
		const len = G.game.history.length;
		const cur = viewPly ?? len;
		const target =
			where === "first"
				? 0
				: where === "prev"
					? cur - 1
					: where === "next"
						? cur + 1
						: len;
		showPly(Math.max(0, Math.min(len, target)));
	}

	/* ------------------------------------------------------------------ the Bot's face and words */

	function setMood(mood, ms = 0) {
		if (!G) return;
		G.mood = mood;
		const f = side.querySelector("[data-face]");
		if (f) f.innerHTML = opponentFace(mood);
		clearTimeout(moodTimer);
		if (ms)
			moodTimer = setTimeout(() => {
				if (G && !G.over) setMood(G.thinking ? "thinking" : "idle");
			}, ms);
	}

	function speak(text, mood = "happy", ms = 4200) {
		if (!G) return;
		G.saidAt = Date.now();
		const b = side.querySelector("[data-bubble]");
		if (b) {
			b.textContent = text;
			b.classList.add("show");
			clearTimeout(bubbleTimer);
			bubbleTimer = setTimeout(() => b.classList.remove("show"), ms);
		}
		setMood(mood, ms - 600);
	}

	/* ------------------------------------------------------------------ moves */

	async function onPlayerMove({ from, to, dropped }) {
		if (!G || G.over || G.thinking || viewPly !== null || G.game.turn !== G.you)
			return;
		const options = G.game
			.legalMoves()
			.filter((m) => m.from === from && m.to === to);
		if (!options.length) {
			play("illegal");
			return sync();
		}
		let promotion = null;
		if (options.some((m) => m.promotion)) {
			promotion = await choosePromotion(to);
			if (!promotion) return sync();
		}
		const mv = G.game.move({ from, to, promotion });
		if (!mv) return sync();
		G.arrows = [];
		afterMove(mv, dropped);
		if (!G.over) botMove();
	}

	function afterMove(mv, dropped = false) {
		const over = G.game.over();
		play(
			moveSound(mv, { check: mv.check, mate: over?.reason === "checkmate" }),
		);
		if (G.clock) clockAfterMove(mv.colour);
		persist();
		sync(moveHint(mv, dropped));
		if (over) finish(over);
	}

	function choosePromotion(square) {
		return new Promise((resolve) => {
			promoEl?.remove();
			const r = board.rectOf(square);
			const div = document.createElement("div");
			div.className = "promo";
			div.innerHTML = ["q", "r", "b", "n"]
				.map(
					(t) =>
						`<button data-p="${t}" aria-label="${{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[t]}">${pieceSvg(t, G.you)}</button>`,
				)
				.join("");
			document.body.appendChild(div);
			const w = div.offsetWidth;
			div.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
			div.style.top = `${Math.max(8, Math.min(window.innerHeight - 80, r.top - 70))}px`;
			promoEl = div;
			const done = (v) => {
				div.remove();
				promoEl = null;
				document.removeEventListener("pointerdown", outside, true);
				resolve(v);
			};
			const outside = (e) => {
				if (!div.contains(e.target)) done(null);
			};
			for (const b of div.querySelectorAll("button"))
				b.onclick = () => done(b.dataset.p);
			setTimeout(
				() => document.addEventListener("pointerdown", outside, true),
				0,
			);
		});
	}

	function thinkTime() {
		const level = LEVELS[G.level];
		if (!G.clock) return level.ms ?? 1000;
		const mine = G.you === "w" ? "b" : "w";
		const left = G.clock[mine];
		const budget = left / 35 + G.clock.inc * 0.7;
		return Math.max(150, Math.min(level.ms ?? 1000, budget));
	}

	async function botMove() {
		if (!G || G.over) return;
		const mine = G.you === "w" ? "b" : "w";
		if (G.game.turn !== mine) return;
		const game = G.game;
		const state = G;
		G.thinking = true;
		setMood("thinking");
		updateSide();
		await board.set({ movable: null });
		const started = performance.now();
		let result = null;
		try {
			if (G.mover === "bot") result = await botThinks();
			if (!result) {
				result = await app.engine.move({
					fen: game.startFen,
					moves: game.history.map((h) => h.uci),
					level: G.mover === "bot" ? "easy" : G.level,
					ms: thinkTime(),
				});
				if (G.mover === "bot" && state === G) {
					const l = say("botConfused");
					if (l) speak(l.text, l.mood);
				}
			}
		} catch (error) {
			if (error?.cancelled) return;
			if (state === G) {
				G.thinking = false;
				toast(`The engine stopped: ${error?.message ?? error}`, "error");
				sync();
			}
			return;
		}
		if (state !== G || G.over || !alive) return;
		// a human-like pause for the quick levels, so the reply does not land before the eye
		const human = !LEVELS[G.level].ms || G.mover === "bot";
		const minWait = G.clock ? 250 : human ? 450 + Math.random() * 700 : 300;
		const spent = performance.now() - started;
		if (spent < minWait) await sleep(minWait - spent);
		if (state !== G || G.over || !alive) return;
		G.thinking = false;
		const mv = G.game.move(result.move);
		if (!mv) {
			toast(
				"The engine chose a move that does not fit. Please report this.",
				"error",
			);
			sync();
			return;
		}
		// what the Bot thinks of the person's last move
		const youScore =
			result.book || result.score == null
				? null
				: G.you === "w"
					? result.score
					: -result.score;
		if (G.mover === "engine" && G.level !== "beginner" && !result.book) {
			const event = judge(G.lastYouScore, youScore);
			if (event && Date.now() - G.saidAt > 8000) {
				const l = say(event, { chance: event === "bigSlip" ? 0.9 : 0.55 });
				if (l) speak(l.text, l.mood);
			} else if (mv.check && Date.now() - G.saidAt > 8000) {
				const l = say("checkGiven", { chance: 0.35 });
				if (l) speak(l.text, l.mood);
			} else if (
				mv.captured &&
				VALUE[mv.captured] >= 3 &&
				Date.now() - G.saidAt > 10000
			) {
				const l = say("capture", { chance: 0.3 });
				if (l) speak(l.text, l.mood);
			} else setMood("idle");
		} else if (result.say && G.mover === "bot") speak(result.say, "playful");
		else setMood("idle");
		if (youScore != null) G.lastYouScore = youScore;
		afterMove(mv);
	}

	/** The Bot chooses its own move with the person's model; null when it could not. */
	async function botThinks() {
		if (!window.deepbot?.think) return null;
		const game = G.game;
		const colour = game.turn === "w" ? "white" : "black";
		const legal = game.legalMoves().map((m) => m.san);
		const system = `You are ${G.bot.name}, playing a game of chess as ${colour} against a person in the DeepBot Chess app. Play honest, good chess. Reply with one JSON object and nothing else: {"move": "<exactly one move from the legal list, in SAN>", "say": "<a short friendly remark to your opponent, at most 12 words, or an empty string>"}`;
		const history = game.pgn().split("\n\n")[1]?.trim() || "(no moves yet)";
		let feedback = "";
		for (let attempt = 0; attempt < 2; attempt++) {
			const prompt = `Moves so far: ${history}\nPosition (FEN): ${game.fen()}\nYou are ${colour}. Legal moves: ${legal.join(", ")}\n${feedback}Your move?`;
			let text;
			try {
				text = await window.deepbot.think(prompt, { system });
			} catch (error) {
				toast(
					`${G.bot.name} could not answer (${error?.message ?? error}); the engine moved instead.`,
				);
				return null;
			}
			const json = /\{[\s\S]*\}/.exec(text ?? "");
			let move = null;
			let remark = "";
			try {
				const data = JSON.parse(json?.[0] ?? "{}");
				move = String(data.move ?? "").trim();
				remark = String(data.say ?? "")
					.trim()
					.slice(0, 120);
			} catch {
				move = String(text ?? "")
					.trim()
					.split(/\s+/)[0];
			}
			const found = game
				.legalMoves()
				.find(
					(m) =>
						m.san === move ||
						m.san.replace(/[+#]/, "") === move.replace(/[+#]/, "") ||
						m.uci === move,
				);
			if (found)
				return { move: found.uci, score: null, book: false, say: remark };
			feedback = `Your last answer "${String(move).slice(0, 20)}" is not one of the legal moves. Choose exactly one from the list.\n`;
		}
		return null;
	}

	/* ------------------------------------------------------------------ the clock */

	function clockAfterMove(colour) {
		const c = G.clock;
		const now = performance.now();
		if (c.started) {
			c[colour] -= now - c.since;
			c[colour] += c.inc;
		}
		// the clock starts once White has moved
		c.started = true;
		c.since = now;
		startClock();
	}

	function startClock() {
		if (!G?.clock) return;
		G.clock.since = performance.now();
		clearInterval(tickTimer);
		tickTimer = setInterval(tick, 100);
		updateClocks();
	}
	function stopClock() {
		clearInterval(tickTimer);
		tickTimer = 0;
	}
	let lastTickSecond = -1;
	function tick() {
		if (!G?.clock || G.over) return stopClock();
		updateClocks();
		const c = G.clock;
		if (!c.started) return;
		const turn = G.game.turn;
		const left = c[turn] - (performance.now() - c.since);
		if (turn === G.you && left < 10_000 && left > 0) {
			const s = Math.ceil(left / 1000);
			if (s !== lastTickSecond) {
				lastTickSecond = s;
				play("tick");
			}
		}
		if (left <= 0) {
			c[turn] = 0;
			app.engine.cancel();
			G.thinking = false;
			// time is up; a side that cannot mate does not win on time
			const other = turn === "w" ? "b" : "w";
			const pieces = G.game
				.board()
				.flat()
				.filter((p) => p && p.colour === other && p.type !== "k");
			const cannot =
				!pieces.length ||
				(pieces.length === 1 && "nb".includes(pieces[0].type));
			const who = turn === G.you ? "You" : opponentName();
			if (cannot)
				G.game.end(
					"1/2-1/2",
					`${who} ran out of time, but the other side cannot mate`,
				);
			else G.game.end(turn === "w" ? "0-1" : "1-0", `${who} ran out of time`);
			finish(G.game.over());
		}
	}
	function updateClocks() {
		if (!G?.clock) return;
		const c = G.clock;
		for (const colour of ["w", "b"]) {
			const el2 = side.querySelector(`[data-clock="${colour}"]`);
			if (!el2) continue;
			const running = c.started && !G.over && G.game.turn === colour;
			const left = running
				? c[colour] - (performance.now() - c.since)
				: c[colour];
			el2.textContent = clockText(left);
			el2.classList.toggle("on", running);
			el2.classList.toggle("low", left < 20_000);
		}
	}

	/* ------------------------------------------------------------------ help, takebacks, the end */

	async function hint() {
		if (!G || G.over || G.thinking || G.game.turn !== G.you) return;
		const btn = side.querySelector("[data-hint]");
		btn.disabled = true;
		try {
			const r = await app.engine.analyse({
				fen: G.game.startFen,
				moves: G.game.history.map((h) => h.uci),
				ms: 900,
			});
			if (!G || G.game.turn !== G.you || !r?.move) return;
			G.hints++;
			G.arrows = [
				{ from: r.move.slice(0, 2), to: r.move.slice(2, 4), kind: "hint" },
			];
			const l = say("hint");
			if (l) speak(l.text, l.mood, 6000);
			persist();
			sync();
		} catch (error) {
			if (!error?.cancelled) toast(error?.message ?? String(error), "error");
		} finally {
			updateSide();
		}
	}

	async function takeback() {
		if (!G) return;
		app.engine.cancel();
		G.thinking = false;
		const g = G.game;
		if (!g.history.some((m) => m.colour === G.you)) return;
		const wasOver = Boolean(G.over);
		// back to the person's last move, then before it
		while (g.history.length && g.history.at(-1).colour !== G.you) g.undo();
		g.undo();
		G.over = null;
		G.takebacks++;
		G.arrows = [];
		G.lastYouScore = null;
		viewPly = null;
		stage.querySelector(".over")?.remove();
		if (wasOver) renderGame();
		const l = say("takeback", { chance: 0.6 });
		if (l) speak(l.text, l.mood, 2500);
		else setMood("idle");
		persist();
		await sync();
		if (G.game.turn !== G.you) botMove();
	}

	async function offerDraw() {
		if (!G || G.over || G.thinking) return;
		if (G.game.history.length < 20) {
			speak("It's a bit early for a draw. Let's play on.", "playful", 3500);
			return;
		}
		const btn = side.querySelector("[data-draw]");
		btn.disabled = true;
		try {
			const r = await app.engine.analyse({
				fen: G.game.startFen,
				moves: G.game.history.map((h) => h.uci),
				ms: 600,
			});
			const botScore = G.you === "w" ? -r.score : r.score;
			if (botScore <= 40) {
				speak("A draw it is. Good game.", "happy");
				G.game.end("1/2-1/2", "draw agreed");
				finish(G.game.over());
			} else speak("No thanks, I'd like to play on.", "proud", 3500);
		} catch (error) {
			if (!error?.cancelled) toast(error?.message ?? String(error), "error");
		} finally {
			updateSide();
		}
	}

	function resign() {
		if (!G || G.over) return;
		app.engine.cancel();
		G.thinking = false;
		G.game.end(G.you === "w" ? "0-1" : "1-0", "you resigned");
		finish(G.game.over());
	}

	function pgnText() {
		const them =
			G.mover === "bot"
				? G.bot.name
				: `Chess engine (${LEVELS[G.level].label})`;
		const white = G.you === "w" ? "You" : them;
		const black = G.you === "b" ? "You" : them;
		const headers = {
			Event: "DeepBot Chess",
			Site: "DeepBot",
			White: white,
			Black: black,
			Level: G.mover === "bot" ? `${G.bot.name} itself` : LEVELS[G.level].label,
		};
		if (G.clock) headers.TimeControl = `${G.time.base * 60}+${G.time.inc ?? 0}`;
		if (G.over?.reason) headers.Termination = G.over.reason;
		return G.game.pgn({ headers });
	}

	async function finish(over) {
		if (!G || G.over) return;
		G.over = over;
		G.thinking = false;
		stopClock();
		app.engine.cancel();
		const you = G.you;
		const win =
			(over.result === "1-0" && you === "w") ||
			(over.result === "0-1" && you === "b");
		const draw = over.result === "1/2-1/2";
		play(draw ? "draw" : win ? "win" : "lose");
		const key = G.mover === "bot" ? "bot" : G.level;
		const stats = app.progress.stats[key] ?? { w: 0, l: 0, d: 0 };
		if (draw) stats.d++;
		else if (win) stats.w++;
		else stats.l++;
		app.progress.stats[key] = stats;
		app.saveProgress();
		persist();
		sync();
		const pgn = pgnText();
		const path = await saveGame(pgn, { level: key, opponent: G.bot.name });
		G.savedPath = path;
		G.pgn = pgn;
		const line = say(
			draw
				? "draw"
				: win
					? "lost"
					: over.reason === "you resigned"
						? "resigned"
						: "won",
		);
		const mood = draw ? "neutral" : win ? "sad" : "celebrate";
		setMood(line?.mood ?? mood);
		const reason =
			REASONS[over.reason] ??
			`${over.reason[0].toUpperCase()}${over.reason.slice(1)}.`;
		const title = draw ? "A draw" : win ? "You won" : `${opponentName()} won`;
		const div = document.createElement("div");
		div.className = "over";
		div.innerHTML = `<div class="card"><div class="face">${opponentFace(line?.mood ?? mood)}</div><h2>${esc(title)}</h2><p>${esc(reason)}${line ? `<br>“${esc(line.text)}”` : ""}</p>
			<div class="row"><button class="btn primary" data-review>${icon("chart")}Review the game</button><button class="btn" data-rematch>${icon("refresh")}Rematch</button><button class="btn ghost" data-close>Look at the board</button></div></div>`;
		stage.appendChild(div);
		wireOver(div);
		div.querySelector("[data-close]").onclick = () => div.remove();
	}

	function wireOver(root) {
		const review = root.querySelector("[data-review]");
		if (review)
			review.onclick = () =>
				app.go("review", {
					pgn: G.pgn ?? pgnText(),
					path: G.savedPath ?? null,
					you: G.you,
					bot: G.bot.id,
					from: "play",
				});
		const rematch = root.querySelector("[data-rematch]");
		if (rematch)
			rematch.onclick = () => {
				stage.querySelector(".over")?.remove();
				picks.opponent = G.bot.id;
				picks.level = G.level;
				picks.mover = G.mover;
				picks.time = G.time.id;
				// swap colours for the rematch
				picks.colour = G.you === "w" ? "b" : "w";
				startGame();
				picks.colour = app.settings.colour;
			};
		const fresh = root.querySelector("[data-new]");
		if (fresh)
			fresh.onclick = () => {
				stage.querySelector(".over")?.remove();
				showSetup();
			};
		const tb = root.querySelector("[data-takeback]");
		if (tb) tb.onclick = takeback;
	}

	/* ------------------------------------------------------------------ asking the Bot */

	async function askBot(question) {
		if (!G) return;
		side.querySelector("[data-askbox]")?.classList.remove("open");
		const g = viewPly !== null ? G.game.at(viewPly) : G.game;
		let engineView = "";
		try {
			const r = await app.engine.analyse({
				fen: G.game.startFen,
				moves: g.history.map((h) => h.uci),
				ms: 700,
			});
			const you = G.you === "w" ? r.score : -r.score;
			const line = sanLine(g.fen(), r.pv ?? []);
			engineView = `The chess engine's view of this position: ${isMate(you) ? `forced mate (${scoreText(you)} from the person's side)` : `${scoreText(you)} from the person's side (positive is better for them)`}; best line: ${line.join(" ") || "none"}.`;
		} catch {
			/* the question goes without the engine's view */
		}
		const colour = G.you === "w" ? "White" : "Black";
		const context = [
			`The person is playing chess against you in the Chess app, which is open beside this conversation. They play ${colour}; you play ${G.you === "w" ? "Black" : "White"}${G.mover === "bot" ? ", choosing your own moves" : ` at the ${LEVELS[G.level].label} level (the app's engine picks your moves at that level)`}.`,
			`Moves so far: ${G.game.pgn().split("\n\n")[1]?.trim() || "none"}`,
			viewPly !== null
				? `They are looking at the position after move ${Math.ceil(viewPly / 2)} (${viewPly} half-moves in).`
				: "",
			`Position they are asking about (FEN): ${g.fen()}`,
			engineView,
			"Answer as their opponent and coach: briefly, in plain words, moves in SAN. Explain ideas rather than just giving moves, and do not give away more of your own plan than they ask for.",
		]
			.filter(Boolean)
			.join("\n");
		await app.ask(question, context);
	}

	/* ------------------------------------------------------------------ keys and leaving */

	const onKey = (e) => {
		if (!G || e.target.closest?.("input, textarea")) return;
		if (e.key === "ArrowLeft") nav("prev");
		else if (e.key === "ArrowRight") nav("next");
		else if (e.key === "ArrowUp") nav("first");
		else if (e.key === "ArrowDown") nav("last");
		else if (e.key === "f") board.flip();
		else return;
		e.preventDefault();
	};
	document.addEventListener("keydown", onKey);

	const saved = await load("current", null);
	if (!alive) return { destroy() {} };
	if (params.startFen) {
		// play on from a position (a review, a lesson, a card): a fresh casual game from there
		try {
			new Game(params.startFen);
			await startGame({
				fen: params.startFen,
				you: params.you === "b" ? "b" : "w",
			});
		} catch (error) {
			toast(`That position cannot be played: ${error.message}`, "error");
			await showSetup();
		}
	} else if (saved?.moves?.length && params.resume !== false && !params.setup) {
		// straight back into the game in progress
		await resumeGame(saved);
	} else await showSetup();

	return {
		destroy() {
			watching?.stop();
			alive = false;
			stopClock();
			persist();
			clearTimeout(bubbleTimer);
			clearTimeout(moodTimer);
			promoEl?.remove();
			document.removeEventListener("keydown", onKey);
			board.destroy();
		},
		botsChanged() {
			if (!G && !watching) showSetup();
		},
		setBoardMode: syncTools,
	};
}

export { destsOf };
