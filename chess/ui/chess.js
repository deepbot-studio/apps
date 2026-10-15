/*
 * CHESS: play the Bot, learn the game, solve puzzles, look back at your games.
 *
 * The shell: the top bar (Play, Learn, Puzzles, Games; 3D or flat board; sound), settings and
 * progress, the person's Bots (from DeepBot, with their faces), the engine, and "ask the Bot"
 * beside the page. Each view is its own module and mounts into the page below the bar.
 */
import { createBoardView } from "./lib/boardview.js";
import { createEngine } from "./lib/engine-client.js";
import { mountGames } from "./lib/games.js";
import { mountLearn } from "./lib/learn.js";
import { mountPlay } from "./lib/play.js";
import { mountPuzzles } from "./lib/puzzles.js";
import { mountReview } from "./lib/review.js";
import { setSound } from "./lib/sound.js";
import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, load, save } from "./lib/store.js";
import { esc, icon, toast } from "./lib/ui.js";

const db = window.deepbot;

export const app = {
	settings: { ...DEFAULT_SETTINGS },
	progress: structuredClone(DEFAULT_PROGRESS),
	bots: [],
	botId: null,
	features: [],
	dark: false,
	engine: createEngine(),
	view: null,
	current: null, // the mounted view: { destroy, setBoardMode?, setTheme? }
	boards: new Set(),
};

/** The Bot the person plays and learns with. */
app.bot = () =>
	app.bots.find((b) => b.id === app.settings.opponent) ??
	app.bots.find((b) => b.id === app.botId) ??
	app.bots[0] ?? { id: null, name: "DeepBot", faces: {} };

app.saveSettings = () => save("settings", app.settings);
app.saveProgress = () => save("progress", app.progress);

/** A board in a view, following the app's 3D/2D choice and theme. */
app.board = async (host, opts = {}) => {
	const view = await createBoardView(host, {
		mode: app.settings.board,
		dark: app.dark,
		onFallback: (why) => {
			toast(why);
		},
		...opts,
	});
	app.boards.add(view);
	const destroy = view.destroy;
	view.destroy = () => {
		app.boards.delete(view);
		destroy();
	};
	return view;
};

/**
 * Ask the Bot, beside the page: the person's words as they would say them, with what the Bot needs
 * to know about the board as instructions (an older DeepBot gets it all in one message).
 */
app.ask = async (text, context) => {
	if (!db?.ask) {
		toast("Asking the Bot needs DeepBot.");
		return;
	}
	try {
		if (db.features?.includes("ask-beside"))
			await db.ask(text, { instructions: [context] });
		else await db.ask(`${text}\n\n${context}`);
	} catch (error) {
		toast(error?.message ?? String(error), "error");
	}
};

const VIEWS = {
	play: { label: "Play", icon: "knight", mount: mountPlay },
	learn: { label: "Learn", icon: "book", mount: mountLearn },
	puzzles: { label: "Puzzles", icon: "puzzle", mount: mountPuzzles },
	games: { label: "Games", icon: "chart", mount: mountGames },
	review: { label: "Review", mount: mountReview, hidden: true },
};

function topBar() {
	const tab = (id) => {
		const v = VIEWS[id];
		const current =
			app.view === id || (id === "games" && app.view === "review");
		return `<button class="tab" data-go="${id}" ${current ? 'aria-current="page"' : ""}>${icon(v.icon)}<span>${v.label}</span></button>`;
	};
	return `<header class="top">
		<div class="brand">${icon("knight")}<span>Chess</span></div>
		<nav class="tabs" aria-label="Sections">${["play", "learn", "puzzles", "games"].map(tab).join("")}</nav>
		<div class="grow"></div>
		<div class="seg" role="group" aria-label="Board">
			<button data-board="3d" aria-pressed="${app.settings.board === "3d"}" title="3D board">${icon("cube")}3D</button>
			<button data-board="2d" aria-pressed="${app.settings.board === "2d"}" title="Flat board">${icon("grid")}2D</button>
		</div>
		<button class="iconbtn" data-sound title="${app.settings.sound ? "Sound on" : "Sound off"}" aria-label="${app.settings.sound ? "Turn sound off" : "Turn sound on"}">${icon(app.settings.sound ? "soundOn" : "soundOff")}</button>
	</header><main class="view" id="view"></main>`;
}

function refreshTop() {
	const root = document.getElementById("root");
	const header = root.querySelector(".top");
	const tmp = document.createElement("div");
	tmp.innerHTML = topBar();
	header.replaceWith(tmp.firstElementChild);
	wireTop();
}

function wireTop() {
	const root = document.getElementById("root");
	for (const b of root.querySelectorAll(".top [data-go]"))
		b.onclick = () => go(b.dataset.go);
	for (const b of root.querySelectorAll(".top [data-board]"))
		b.onclick = async () => {
			if (app.settings.board === b.dataset.board) return;
			app.settings.board = b.dataset.board;
			app.saveSettings();
			refreshTop();
			for (const board of app.boards) await board.setMode(app.settings.board);
			app.current?.setBoardMode?.();
		};
	root.querySelector(".top [data-sound]").onclick = () => {
		app.settings.sound = !app.settings.sound;
		setSound(app.settings.sound);
		app.saveSettings();
		refreshTop();
	};
}

let going = 0;
export async function go(view, params = {}) {
	const ticket = ++going;
	app.engine.cancel();
	try {
		app.current?.destroy?.();
	} catch {
		/* a view that fails to leave still leaves */
	}
	app.current = null;
	app.view = view;
	refreshTop();
	const el = document.getElementById("view");
	el.innerHTML = "";
	el.className = `view view-${view}`;
	try {
		const mounted = await VIEWS[view].mount(app, el, params);
		if (ticket !== going) mounted?.destroy?.();
		else app.current = mounted;
	} catch (error) {
		console.error(error);
		el.innerHTML = `<div class="setup"><h2>Something went wrong</h2><p class="lead">${esc(error?.message ?? error)}</p><div><button class="btn" data-go-home>Back to Play</button></div></div>`;
		el.querySelector("[data-go-home]").onclick = () => go("play");
	}
}
app.go = go;

function applyBots(data) {
	app.bots = Array.isArray(data?.bots) ? data.bots : [];
	app.botId = data?.bot ?? app.bots[0]?.id ?? null;
	app.current?.botsChanged?.();
}

async function main() {
	let init = {};
	if (db) {
		init = await db.ready;
		app.features = db.features ?? [];
		app.dark = Boolean(db.dark);
		applyBots(init);
		db.on("bots", applyBots);
		db.on("theme", ({ dark }) => {
			app.dark = Boolean(dark);
			for (const board of app.boards) board.setTheme(app.dark);
		});
	}
	const [settings, progress] = await Promise.all([
		load("settings", {}),
		load("progress", {}),
	]);
	app.settings = { ...DEFAULT_SETTINGS, ...settings };
	app.progress = {
		...structuredClone(DEFAULT_PROGRESS),
		...progress,
		puzzle: { ...DEFAULT_PROGRESS.puzzle, ...(progress?.puzzle ?? {}) },
	};
	setSound(app.settings.sound);
	const root = document.getElementById("root");
	app.view = "play";
	root.innerHTML = topBar();
	wireTop();
	const args = db?.args ?? {};
	const start = VIEWS[args.view] ? args.view : "play";
	await go(start, args);
}

main();
