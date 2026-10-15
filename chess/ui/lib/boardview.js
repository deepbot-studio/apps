/*
 * ONE BOARD, TWO LOOKS: the 3D board or the flat one behind the same calls, switchable at any time
 * without losing the position. Falls back to 2D on a computer without WebGL.
 */
import { createBoard2d, piecesFromGame } from "./board2d.js";
import { createBoard3d, webglWorks } from "./board3d.js";

export { piecesFromGame };

/** The squares a move touches, so the board can animate it (rook of a castle, pawn taken en passant). */
export function moveHint(mv, dropped = false) {
	if (!mv) return null;
	const hint = { from: mv.from, to: mv.to, dropped };
	if (mv.castle) {
		const rank = mv.from[1];
		hint.rook =
			mv.castle === "king"
				? [`h${rank}`, `f${rank}`]
				: [`a${rank}`, `d${rank}`];
	}
	if (mv.enPassant) hint.ep = mv.to[0] + mv.from[1];
	return hint;
}

/** Legal moves as the boards want them: Map(from => [to, ...]). */
export function destsOf(game) {
	const dests = new Map();
	for (const m of game.legalMoves()) {
		const list = dests.get(m.from) ?? [];
		if (!list.includes(m.to)) list.push(m.to);
		dests.set(m.from, list);
	}
	return dests;
}

/** Everything the board shows for a game: pieces, last move, check, who may move. */
export function stateOf(
	game,
	{ canMove = null, arrows = [], marks = {} } = {},
) {
	const last = game.history.at(-1);
	return {
		pieces: piecesFromGame(game),
		last: last ? [last.from, last.to] : null,
		check: game.checkSquare(),
		movable: canMove ? { colour: canMove, dests: destsOf(game) } : null,
		arrows,
		marks,
	};
}

export async function createBoardView(
	host,
	{
		mode = "3d",
		orientation = "w",
		onMove,
		onSelect,
		dark = false,
		onFallback,
		tray = true,
	} = {},
) {
	let board = null;
	let current = mode;
	let orient = orientation;
	let state = { pieces: {} };
	let isDark = dark;

	async function build(kind) {
		board?.destroy();
		board = null;
		host.classList.toggle("is-3d", kind === "3d");
		host.classList.toggle("is-2d", kind === "2d");
		if (kind === "3d") {
			if (!webglWorks()) {
				onFallback?.(
					"This computer cannot draw the 3D board, so the flat one is shown.",
				);
				return build("2d");
			}
			try {
				board = await createBoard3d(host, {
					orientation: orient,
					onMove,
					onSelect,
					dark: isDark,
					tray,
				});
			} catch (error) {
				onFallback?.(
					`The 3D board could not start (${error?.message ?? error}), so the flat one is shown.`,
				);
				return build("2d");
			}
		} else
			board = createBoard2d(host, { orientation: orient, onMove, onSelect });
		current = kind;
		await board.set({ ...state, move: null });
		return board;
	}

	await build(mode);

	return {
		get mode() {
			return current;
		},
		get orientation() {
			return orient;
		},
		async setMode(kind) {
			if (kind === current) return;
			await build(kind);
		},
		set(next) {
			state = { ...state, ...next };
			// remember everything but the one-off animation hint
			delete state.move;
			return Promise.resolve(board.set(next));
		},
		orient(o) {
			orient = o;
			board.orient(o);
		},
		flip() {
			orient = orient === "w" ? "b" : "w";
			board.orient(orient);
		},
		select: (sq) => board.select(sq),
		rectOf: (sq) => board.rectOf(sq),
		resize: () => board.resize?.(),
		resetView: () => board.resetView?.(),
		setTheme(d) {
			isDark = d;
			board.setTheme?.(d);
		},
		snapshot: () => board.snapshot?.() ?? null,
		destroy: () => board?.destroy(),
	};
}
