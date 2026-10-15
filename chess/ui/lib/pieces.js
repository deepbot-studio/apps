/*
 * THE FLAT PIECES: the 2D board's set, drawn for this app as plain SVG shapes (a simple Staunton
 * outline: crown, mitre, battlements, the horse's head), so they look the same on every computer.
 * `pieceSvg("n", "w")` gives an <svg> string; the colours follow the board's theme variables.
 */
const BASE =
	'<path d="M24 86h52a4 4 0 0 1 4 4v3H20v-3a4 4 0 0 1 4-4z"/><path d="M29 80h42l-2 6H31z"/>';

const SHAPES = {
	p: '<circle cx="50" cy="28" r="12"/><path d="M40 41h20l-2 5H42z"/><path d="M42 46c0 13-6 23-12 34h40c-6-11-12-21-12-34z"/>',
	r: '<path d="M34 41h32l2 39H32z"/><path d="M29 16h9v8h6v-8h12v8h6v-8h9v20l-4 5H33l-4-5z"/>',
	n: '<path d="M30 80c0-12 5-19 14-25-7 0-14 3-18-3-4-6 3-13 9-19 4-4 5-10 8-14l2-9 6 8c13 2 21 15 21 31 0 14-4 22-2 31z"/><circle class="d" cx="46" cy="30" r="2.6"/><path class="l" d="M55 22c7 6 10 15 9 26"/>',
	b: '<path d="M40 56c-2 10-6 17-10 24h40c-4-7-8-14-10-24z"/><path d="M36 50h28v6H36z"/><path d="M50 15c14 9 16 23 8 35H42c-8-12-6-26 8-35z"/><circle cx="50" cy="11" r="4.5"/><path class="l" d="M55 25l-9 12"/>',
	q: '<path d="M38 53c0 11-4 19-8 27h40c-4-8-8-16-8-27z"/><path d="M34 48h32v5H34z"/><path d="M32 48l-4-24 10 12 1-16 7 14 4-18 4 18 7-14 1 16 10-12-4 24z"/><circle cx="28" cy="22" r="3.6"/><circle cx="39" cy="18" r="3.6"/><circle cx="50" cy="14" r="3.6"/><circle cx="61" cy="18" r="3.6"/><circle cx="72" cy="22" r="3.6"/>',
	k: '<path d="M38 53c0 11-4 19-8 27h40c-4-8-8-16-8-27z"/><path d="M34 48h32v5H34z"/><path d="M36 48c-7-12-1-22 14-18 15-4 21 6 14 18z"/><path d="M47 5h6v6h6v6h-6v12h-6V17h-6v-6h6z"/>',
};

export function pieceSvg(type, colour) {
	return `<svg class="pc ${colour === "w" ? "pw" : "pb"}" viewBox="0 0 100 100" aria-hidden="true"><g>${SHAPES[type]}${BASE}</g></svg>`;
}

export const PIECE_NAMES = {
	p: "pawn",
	n: "knight",
	b: "bishop",
	r: "rook",
	q: "queen",
	k: "king",
};
