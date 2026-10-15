/*
 * WHAT CHESS REMEMBERS. Settings, learning progress, puzzle rating and the game in progress live in
 * the app's own storage (per person). Finished games are PGN files in the workspace under
 * chess/games/, where the Bot can read them too ("look at my last game").
 */
const mem = new Map();
const has = () => typeof window !== "undefined" && window.deepbot?.storage;

export async function load(key, fallback) {
	try {
		if (has()) {
			const v = await window.deepbot.storage.get(key);
			return v ?? fallback;
		}
	} catch {
		/* storage unavailable: memory only */
	}
	return mem.has(key) ? mem.get(key) : fallback;
}

const timers = new Map();
/** Save, a moment later (several changes in a row are one write). */
export function save(key, value, delay = 250) {
	mem.set(key, value);
	clearTimeout(timers.get(key));
	timers.set(
		key,
		setTimeout(() => {
			timers.delete(key);
			if (has()) window.deepbot.storage.set(key, value).catch(() => {});
		}, delay),
	);
}

export const DEFAULT_SETTINGS = {
	board: "3d",
	sound: true,
	level: "medium",
	colour: "w",
	time: "none",
	opponent: null,
	mover: "engine",
	coach: true,
	hints: true,
};

export const DEFAULT_PROGRESS = {
	lessons: {},
	puzzle: { rating: 800, solved: {}, streak: 0, best: 0, played: 0 },
	stats: {},
};

export const GAMES_DIR = "chess/games";

function stamp(d = new Date()) {
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Keep a finished game as a PGN file; returns its path (or null when files are unavailable). */
export async function saveGame(pgn, { level, opponent } = {}) {
	if (!window.deepbot?.files) return null;
	const slug = String(opponent || "bot")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 24);
	const path = `${GAMES_DIR}/${stamp()}-${slug || "bot"}-${level || "game"}.pgn`;
	try {
		await window.deepbot.files.write(path, pgn);
		return path;
	} catch {
		return null;
	}
}

function headersOf(pgn) {
	const h = {};
	for (const m of String(pgn).matchAll(/^\[(\w+)\s+"([^"]*)"\]/gm))
		h[m[1]] = m[2];
	return h;
}

/** The saved games, newest first: [{ path, name, headers, modified }]. */
export async function listGames(limit = 60) {
	if (!window.deepbot?.files) return [];
	try {
		const { items } = await window.deepbot.files.list(GAMES_DIR);
		const files = items
			.filter((i) => !i.dir && i.name.endsWith(".pgn"))
			.sort((a, b) => b.modified - a.modified);
		const out = [];
		for (const f of files.slice(0, limit)) {
			try {
				const text = await window.deepbot.files.read(f.path);
				out.push({
					path: f.path,
					name: f.name,
					modified: f.modified,
					headers: headersOf(text),
					pgn: text,
				});
			} catch {
				/* unreadable: skipped */
			}
		}
		return out;
	} catch {
		return [];
	}
}

export async function deleteGame(path) {
	await window.deepbot.files.delete(path);
}
