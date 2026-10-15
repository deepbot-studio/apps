/*
 * THE ENGINE: this app's own chess player. A classic alpha-beta searcher written for DeepBot:
 * iterative deepening with aspiration windows, principal-variation search, a transposition table,
 * null-move pruning, late-move reductions, futility pruning, killer and history move ordering, and a
 * quiescence search over captures so it never stops counting in the middle of an exchange. The
 * evaluation adds pawn structure, mobility, bishops, rooks on open files, the king's pawn shield
 * and the endgame technique of driving a bare king to the edge to the piece-square score the board
 * keeps.
 *
 * Levels do not just think less: a weaker level plays like a weaker person. Beginner looks one move
 * ahead and does not count the recapture (it grabs a defended pawn with its queen); Easy sees a
 * little further and sometimes picks a merely decent move; Medium calculates properly but not
 * deeply; Hard and Expert search for real, on a clock.
 *
 * Runs anywhere (the worker, the page, tests): no DOM.
 */
import { BOOK } from "./book.js";
import {
	BISHOP,
	F_CAPTURE,
	KING,
	KNIGHT,
	moveFrom,
	movePromo,
	moveTo,
	PAWN,
	Position,
	QUEEN,
	ROOK,
	sqName,
} from "./rules.js";

export const INF = 32000;
export const MATE = 30000;
const MAX_PLY = 96;

/** The levels, weakest first. `depth` caps the search, `ms` is the time per move. */
export const LEVELS = {
	beginner: {
		label: "Beginner",
		about:
			"Just learned the moves. Leaves pieces hanging and takes whatever it can.",
		depth: 1,
		quiesce: false,
		temperature: 90,
		blunder: 0.12,
		book: 4,
	},
	easy: {
		label: "Easy",
		about: "Plays casually. Sees simple threats, misses most tactics.",
		depth: 2,
		quiesce: true,
		temperature: 45,
		blunder: 0.06,
		book: 6,
	},
	medium: {
		label: "Medium",
		about: "A solid club player. Punishes loose pieces, still makes mistakes.",
		depth: 3,
		quiesce: true,
		temperature: 18,
		blunder: 0.015,
		book: 10,
	},
	hard: {
		label: "Hard",
		about: "A strong club player. Calculates several moves ahead.",
		depth: 7,
		ms: 700,
		book: 14,
	},
	expert: {
		label: "Expert",
		about: "Plays to win. Thinks longer and rarely gives anything away.",
		depth: 64,
		ms: 2200,
		book: 16,
	},
};

const VAL = [0, 100, 320, 330, 500, 950, 0];

const N_D = [33, 31, 18, 14, -33, -31, -18, -14];
const B_D = [17, 15, -17, -15];
const R_D = [16, 1, -16, -1];

const PASSED_MG = [0, 4, 8, 14, 26, 44, 70, 0];
const PASSED_EG = [0, 8, 14, 24, 44, 76, 120, 0];

/** The position's score in centipawns for the side to move. */
export function evaluate(pos) {
	const b = pos.board;
	let mg = pos.mg;
	let eg = pos.eg;
	const phase = Math.min(24, pos.phase);

	// one pass: pawns per file, mobility, bishops, rooks
	const wFile = [0, 0, 0, 0, 0, 0, 0, 0];
	const bFile = [0, 0, 0, 0, 0, 0, 0, 0];
	const wMin = [8, 8, 8, 8, 8, 8, 8, 8]; // lowest rank of a white pawn on the file
	const bMax = [-1, -1, -1, -1, -1, -1, -1, -1]; // highest rank of a black pawn on the file
	const wMax = [-1, -1, -1, -1, -1, -1, -1, -1];
	const bMin = [8, 8, 8, 8, 8, 8, 8, 8];
	let wBishops = 0;
	let bBishops = 0;
	let wMat = 0;
	let bMat = 0;
	let wPawns = 0;
	let bPawns = 0;
	const rooks = [];
	for (let s = 0; s < 128; s++) {
		if (s & 0x88) {
			s += 7;
			continue;
		}
		const p = b[s];
		if (!p) continue;
		const t = p & 7;
		const black = p & 8;
		const f = s & 7;
		const r = s >> 4;
		if (t === PAWN) {
			if (black) {
				bFile[f]++;
				bPawns++;
				if (r > bMax[f]) bMax[f] = r;
				if (r < bMin[f]) bMin[f] = r;
			} else {
				wFile[f]++;
				wPawns++;
				if (r < wMin[f]) wMin[f] = r;
				if (r > wMax[f]) wMax[f] = r;
			}
			continue;
		}
		if (t === KING) continue;
		if (black) bMat += VAL[t];
		else wMat += VAL[t];
		// mobility: squares reached that are not our own pieces
		let n = 0;
		if (t === KNIGHT) {
			for (let i = 0; i < 8; i++) {
				const q = s + N_D[i];
				if (!(q & 0x88) && (!b[q] || (b[q] & 8) !== black)) n++;
			}
			const v = (n - 4) * 4;
			if (black) {
				mg -= v;
				eg -= v;
			} else {
				mg += v;
				eg += v;
			}
		} else {
			const ds = t === BISHOP ? B_D : t === ROOK ? R_D : null;
			const dirs = ds ?? [...B_D, ...R_D];
			for (const d of dirs) {
				let q = s + d;
				while (!(q & 0x88)) {
					if (b[q]) {
						if ((b[q] & 8) !== black) n++;
						break;
					}
					n++;
					q += d;
				}
			}
			let vm;
			let ve;
			if (t === BISHOP) {
				vm = (n - 6) * 4;
				ve = (n - 6) * 5;
				if (black) bBishops++;
				else wBishops++;
			} else if (t === ROOK) {
				vm = (n - 6) * 2;
				ve = (n - 6) * 4;
				rooks.push(s, black);
			} else {
				vm = n - 13;
				ve = (n - 13) * 2;
			}
			if (black) {
				mg -= vm;
				eg -= ve;
			} else {
				mg += vm;
				eg += ve;
			}
		}
	}

	// pawn structure
	for (let f = 0; f < 8; f++) {
		const left = f > 0;
		const right = f < 7;
		if (wFile[f]) {
			if (wFile[f] > 1) {
				mg -= 12 * (wFile[f] - 1);
				eg -= 20 * (wFile[f] - 1);
			}
			if ((!left || !wFile[f - 1]) && (!right || !wFile[f + 1])) {
				mg -= 10 * wFile[f];
				eg -= 14 * wFile[f];
			}
			// the most advanced white pawn on the file: passed?
			const r = wMax[f];
			if (
				bMax[f] <= r &&
				(!left || bMax[f - 1] <= r) &&
				(!right || bMax[f + 1] <= r)
			) {
				mg += PASSED_MG[r];
				eg += PASSED_EG[r];
				const front = (r + 1) * 16 + f;
				if (r < 7 && b[front]) eg -= PASSED_EG[r] >> 2;
			}
		}
		if (bFile[f]) {
			if (bFile[f] > 1) {
				mg += 12 * (bFile[f] - 1);
				eg += 20 * (bFile[f] - 1);
			}
			if ((!left || !bFile[f - 1]) && (!right || !bFile[f + 1])) {
				mg += 10 * bFile[f];
				eg += 14 * bFile[f];
			}
			const r = bMin[f];
			if (
				wMin[f] >= r &&
				(!left || wMin[f - 1] >= r) &&
				(!right || wMin[f + 1] >= r)
			) {
				mg -= PASSED_MG[7 - r];
				eg -= PASSED_EG[7 - r];
				const front = (r - 1) * 16 + f;
				if (r > 0 && b[front]) eg += PASSED_EG[7 - r] >> 2;
			}
		}
	}

	// rooks on open and half-open files
	for (let i = 0; i < rooks.length; i += 2) {
		const f = rooks[i] & 7;
		const black = rooks[i + 1];
		const own = black ? bFile[f] : wFile[f];
		const theirs = black ? wFile[f] : bFile[f];
		let vm = 0;
		let ve = 0;
		if (!own && !theirs) {
			vm = 22;
			ve = 10;
		} else if (!own) {
			vm = 10;
			ve = 6;
		}
		if (black) {
			mg -= vm;
			eg -= ve;
		} else {
			mg += vm;
			eg += ve;
		}
	}

	if (wBishops >= 2) {
		mg += 28;
		eg += 48;
	}
	if (bBishops >= 2) {
		mg -= 28;
		eg -= 48;
	}

	// the king's pawn shield, while there is a middlegame to be careful in
	if (phase > 6) {
		mg += shield(b, pos.kings[0], false) - shield(b, pos.kings[1], true);
	}

	let score = Math.round((mg * phase + eg * (24 - phase)) / 24);

	// a bare king (pawns gone) against more material: drive it to the edge, bring our king close
	const diff = wMat + wPawns * 100 - (bMat + bPawns * 100);
	if (phase <= 8 && Math.abs(diff) >= 300) {
		const winner = diff > 0 ? 0 : 1;
		const loserPawns = winner ? wPawns : bPawns;
		if (!loserPawns) {
			const lk = pos.kings[winner ^ 1];
			const wk = pos.kings[winner];
			const edge = Math.max(
				Math.abs(2 * (lk & 7) - 7),
				Math.abs(2 * (lk >> 4) - 7),
			);
			const near =
				14 - (Math.abs((lk & 7) - (wk & 7)) + Math.abs((lk >> 4) - (wk >> 4)));
			const mop = edge * 10 + near * 6;
			score += winner ? -mop : mop;
		}
	}
	// a side with no pawns and only a minor more cannot win
	if (!wPawns && wMat - bMat <= 330 && score > 0 && wMat < 500) score >>= 3;
	if (!bPawns && bMat - wMat <= 330 && score < 0 && bMat < 500) score >>= 3;

	return (pos.turn ? -score : score) + 10;
}

function shield(b, k, black) {
	const r = k >> 4;
	const home = black ? r >= 6 : r <= 1;
	if (!home) return -20;
	const up = black ? -16 : 16;
	const pawn = black ? 9 : 1;
	let v = 0;
	for (let df = -1; df <= 1; df++) {
		const f = (k & 7) + df;
		if (f < 0 || f > 7) continue;
		const one = k + up + df;
		const two = one + up;
		if (b[one] === pawn) v += 12;
		else if (!(two & 0x88) && b[two] === pawn) v += 6;
		else v -= 10;
	}
	return v;
}

/** Score to text: "+1.4", "-0.3", "#3" (mate in three for the side the score is for), "#-2". */
export function scoreText(cp) {
	if (Math.abs(cp) >= MATE - MAX_PLY) {
		const plies = MATE - Math.abs(cp);
		const moves = Math.ceil(plies / 2);
		return cp > 0 ? `#${moves}` : `#-${moves}`;
	}
	const v = cp / 100;
	return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

export const isMate = (cp) => Math.abs(cp) >= MATE - MAX_PLY;

export class Engine {
	constructor(ttBits = 20) {
		const size = 1 << ttBits;
		this.mask = size - 1;
		this.ttKey = new Int32Array(size);
		this.ttMove = new Int32Array(size);
		this.ttScore = new Int16Array(size);
		this.ttDepth = new Int8Array(size);
		this.ttFlag = new Uint8Array(size);
		this.moves = new Int32Array(MAX_PLY * 256);
		this.order = new Int32Array(MAX_PLY * 256);
		this.killers = new Int32Array(MAX_PLY * 2);
		this.history = new Int32Array(16 * 128);
		this.stopped = false;
	}

	clear() {
		this.ttKey.fill(0);
		this.ttMove.fill(0);
		this.ttFlag.fill(0);
		this.history.fill(0);
	}

	/**
	 * Find a move. `pos` is searched in place (and left as it was).
	 * Options: { depth, ms, quiesce = true, onInfo(info) }.
	 * Returns { move, score, depth, pv: [moves], nodes, ms }.
	 */
	search(pos, { depth = 64, ms = 1000, quiesce = true, onInfo } = {}) {
		this.pos = pos;
		this.nodes = 0;
		this.stopped = false;
		this.quiesce = quiesce;
		this.started = Date.now();
		this.deadline = this.started + ms;
		this.killers.fill(0);
		for (let i = 0; i < this.history.length; i++) this.history[i] >>= 2;
		this.rootPly = pos.ply;
		let best = { move: 0, score: 0, depth: 0, pv: [] };
		let score = 0;
		const legal = pos.legal();
		if (!legal.length) return { ...best, nodes: 0, ms: 0 };
		if (legal.length === 1)
			return {
				move: legal[0],
				score: evaluate(pos),
				depth: 1,
				pv: [legal[0]],
				nodes: 1,
				ms: 0,
			};
		for (let d = 1; d <= Math.min(depth, MAX_PLY - 4); d++) {
			let alpha = -INF;
			let beta = INF;
			let window = 30;
			if (d >= 4) {
				alpha = score - window;
				beta = score + window;
			}
			let s;
			for (;;) {
				s = this.negamax(d, alpha, beta, 0, true);
				if (this.stopped) break;
				if (s <= alpha) {
					alpha = Math.max(-INF, alpha - window * 3);
					window *= 3;
				} else if (s >= beta) {
					beta = Math.min(INF, beta + window * 3);
					window *= 3;
				} else break;
			}
			if (this.stopped && d > 1) break;
			score = s;
			const pv = this.pv(d);
			if (pv.length) best = { move: pv[0], score, depth: d, pv };
			onInfo?.({ ...best, nodes: this.nodes, ms: Date.now() - this.started });
			if (isMate(score) && d > MATE - Math.abs(score)) break;
			// not worth starting a depth that cannot finish
			if (Date.now() - this.started > (this.deadline - this.started) * 0.55)
				break;
		}
		if (!best.move)
			best = { move: legal[0], score: 0, depth: 0, pv: [legal[0]] };
		return { ...best, nodes: this.nodes, ms: Date.now() - this.started };
	}

	/** The principal variation, read back from the transposition table. */
	pv(max) {
		const pos = this.pos;
		const line = [];
		const seen = new Set();
		for (let i = 0; i < max; i++) {
			const idx = pos.lo & this.mask;
			if (this.ttKey[idx] !== pos.hi || !this.ttMove[idx]) break;
			const m = this.ttMove[idx];
			if (!pos.legal().includes(m)) break;
			const key = `${pos.lo}:${pos.hi}`;
			if (seen.has(key)) break;
			seen.add(key);
			line.push(m);
			pos.make(m);
		}
		for (let i = line.length - 1; i >= 0; i--) pos.unmake(line[i]);
		return line;
	}

	checkTime() {
		if ((this.nodes & 2047) === 0 && Date.now() >= this.deadline)
			this.stopped = true;
	}

	negamax(depth, alpha, beta, ply, allowNull) {
		const pos = this.pos;
		const pvNode = beta - alpha > 1;
		if (ply > 0) {
			if (pos.half >= 100 || pos.repeats() > 0) return 0;
			// mate distance pruning
			const mateA = -MATE + ply;
			const mateB = MATE - ply - 1;
			if (mateA > alpha) alpha = mateA;
			if (mateB < beta) beta = mateB;
			if (alpha >= beta) return alpha;
		}
		const inCheck = pos.inCheck();
		if (inCheck) depth++;
		if (depth <= 0)
			return this.quiesce ? this.qsearch(alpha, beta, ply) : evaluate(pos);
		this.nodes++;
		this.checkTime();
		if (this.stopped) return 0;
		if (ply >= MAX_PLY - 2) return evaluate(pos);

		const idx = pos.lo & this.mask;
		let ttMove = 0;
		if (this.ttKey[idx] === pos.hi && this.ttFlag[idx]) {
			ttMove = this.ttMove[idx];
			if (!pvNode && ply > 0 && this.ttDepth[idx] >= depth) {
				let s = this.ttScore[idx];
				if (s > MATE - MAX_PLY) s -= ply;
				else if (s < -MATE + MAX_PLY) s += ply;
				const flag = this.ttFlag[idx];
				if (
					flag === 1 ||
					(flag === 2 && s >= beta) ||
					(flag === 3 && s <= alpha)
				)
					return s;
			}
		}

		let stat = 0;
		if (!inCheck && !pvNode) {
			stat = evaluate(pos);
			// reverse futility: far above beta with little depth left
			if (
				depth <= 3 &&
				stat - 110 * depth >= beta &&
				Math.abs(beta) < MATE - MAX_PLY
			)
				return stat;
			// null move: if passing still keeps us above beta, a real move will too
			if (allowNull && depth >= 3 && stat >= beta && this.hasPieces(pos.turn)) {
				const r = 2 + (depth >> 2);
				pos.makeNull();
				const s = -this.negamax(
					depth - 1 - r,
					-beta,
					-beta + 1,
					ply + 1,
					false,
				);
				pos.unmakeNull();
				if (this.stopped) return 0;
				if (s >= beta) return s >= MATE - MAX_PLY ? beta : s;
			}
		}

		const base = ply * 256;
		const end = pos.gen(this.moves, base, true);
		this.score(base, end, ttMove, ply);

		let legal = 0;
		let best = -INF;
		let bestMove = 0;
		const alpha0 = alpha;
		const k1 = this.killers[ply * 2];
		const k2 = this.killers[ply * 2 + 1];
		for (let i = base; i < end; i++) {
			const m = this.pick(i, end);
			const quiet = !((m >>> 17) & F_CAPTURE) && !movePromo(m);
			pos.make(m);
			if (pos.leftInCheck()) {
				pos.unmake(m);
				continue;
			}
			legal++;
			const gives = pos.inCheck();
			// futility: a quiet move that cannot lift a hopeless score at the last plies
			if (
				!pvNode &&
				!inCheck &&
				!gives &&
				quiet &&
				legal > 1 &&
				depth <= 2 &&
				stat + 120 + 90 * depth <= alpha
			) {
				pos.unmake(m);
				continue;
			}
			let s;
			if (legal === 1)
				s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
			else {
				let r = 0;
				if (
					depth >= 3 &&
					legal > 3 &&
					quiet &&
					!inCheck &&
					!gives &&
					m !== k1 &&
					m !== k2
				) {
					r = 1 + (legal > 8 ? 1 : 0) + (depth > 7 ? 1 : 0);
					if (pvNode) r--;
				}
				s = -this.negamax(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
				if (s > alpha && r)
					s = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
				if (s > alpha && s < beta)
					s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
			}
			pos.unmake(m);
			if (this.stopped) return 0;
			if (s > best) {
				best = s;
				bestMove = m;
				if (s > alpha) {
					alpha = s;
					if (s >= beta) {
						if (quiet) {
							if (m !== k1) {
								this.killers[ply * 2 + 1] = k1;
								this.killers[ply * 2] = m;
							}
							const piece = pos.board[moveFrom(m)];
							this.history[piece * 128 + moveTo(m)] += depth * depth;
						}
						break;
					}
				}
			}
		}
		if (!legal) return inCheck ? -MATE + ply : 0;
		this.store(
			idx,
			depth,
			best,
			best >= beta ? 2 : best > alpha0 ? 1 : 3,
			bestMove,
			ply,
		);
		return best;
	}

	store(idx, depth, score, flag, move, ply) {
		let s = score;
		if (s > MATE - MAX_PLY) s += ply;
		else if (s < -MATE + MAX_PLY) s -= ply;
		// keep a deeper entry for the same position unless this one is exact
		if (
			this.ttKey[idx] === this.pos.hi &&
			this.ttDepth[idx] > depth &&
			flag !== 1
		)
			return;
		this.ttKey[idx] = this.pos.hi;
		this.ttMove[idx] = move;
		this.ttScore[idx] = s;
		this.ttDepth[idx] = depth;
		this.ttFlag[idx] = flag;
	}

	hasPieces(side) {
		const b = this.pos.board;
		for (let s = 0; s < 128; s++) {
			if (s & 0x88) {
				s += 7;
				continue;
			}
			const p = b[s];
			if (p && p >> 3 === side && (p & 7) !== PAWN && (p & 7) !== KING)
				return true;
		}
		return false;
	}

	score(start, end, ttMove, ply) {
		const b = this.pos.board;
		const k1 = this.killers[ply * 2];
		const k2 = this.killers[ply * 2 + 1];
		for (let i = start; i < end; i++) {
			const m = this.moves[i];
			let v;
			if (m === ttMove) v = 2000000;
			else if ((m >>> 17) & F_CAPTURE) {
				const victim = b[moveTo(m)] & 7 || PAWN;
				v = 1000000 + VAL[victim] * 10 - VAL[b[moveFrom(m)] & 7] / 10;
			} else if (movePromo(m) === QUEEN) v = 950000;
			else if (m === k1) v = 900000;
			else if (m === k2) v = 890000;
			else v = Math.min(800000, this.history[b[moveFrom(m)] * 128 + moveTo(m)]);
			this.order[i] = v;
		}
	}

	/** Bring the best-scored remaining move to position i (selection sort, one step). */
	pick(i, end) {
		let best = i;
		for (let j = i + 1; j < end; j++)
			if (this.order[j] > this.order[best]) best = j;
		if (best !== i) {
			const m = this.moves[i];
			this.moves[i] = this.moves[best];
			this.moves[best] = m;
			const o = this.order[i];
			this.order[i] = this.order[best];
			this.order[best] = o;
		}
		return this.moves[i];
	}

	qsearch(alpha, beta, ply) {
		const pos = this.pos;
		this.nodes++;
		this.checkTime();
		if (this.stopped) return 0;
		const stand = evaluate(pos);
		if (ply >= MAX_PLY - 2) return stand;
		if (stand >= beta) return stand;
		if (stand > alpha) alpha = stand;
		const base = ply * 256;
		const end = pos.gen(this.moves, base, false);
		this.score(base, end, 0, ply);
		const b = pos.board;
		for (let i = base; i < end; i++) {
			const m = this.pick(i, end);
			const victim = b[moveTo(m)] & 7 || PAWN;
			// delta pruning: even winning this piece cannot reach alpha
			if (!movePromo(m) && stand + VAL[victim] + 200 < alpha) continue;
			pos.make(m);
			if (pos.leftInCheck()) {
				pos.unmake(m);
				continue;
			}
			const s = -this.qsearch(-beta, -alpha, ply + 1);
			pos.unmake(m);
			if (this.stopped) return 0;
			if (s > alpha) {
				alpha = s;
				if (s >= beta) return s;
			}
		}
		return alpha;
	}

	/** Every legal root move with its own score (for the weaker levels' human-like choice). */
	rootScores(pos, depth, quiesce) {
		this.pos = pos;
		this.nodes = 0;
		this.stopped = false;
		this.quiesce = quiesce;
		this.deadline = Date.now() + 4000;
		this.rootPly = pos.ply;
		const out = [];
		for (const m of pos.legal()) {
			pos.make(m);
			let s;
			if (pos.half >= 100 || pos.repeats() >= 1) s = 0;
			else if (depth <= 1)
				s = quiesce ? -this.qsearch(-INF, INF, 1) : -evaluate(pos);
			else s = -this.negamax(depth - 1, -INF, INF, 1, true);
			pos.unmake(m);
			out.push({ move: m, score: s });
		}
		return out.sort((a, b) => b.score - a.score);
	}
}

/** The book's moves for this position (as UCI), with how often to play each. */
let bookIndex = null;
function bookKey(pos) {
	return pos.fen().split(" ").slice(0, 4).join(" ");
}
export function bookMoves(pos) {
	if (!bookIndex) {
		bookIndex = new Map();
		for (const line of BOOK) {
			const p = new Position();
			for (const san of line.moves.split(" ")) {
				const m = p.parse(san);
				if (!m) break;
				const key = bookKey(p);
				const list = bookIndex.get(key) ?? [];
				const found = list.find((x) => x.move === m);
				if (found) found.weight += line.weight ?? 1;
				else list.push({ move: m, weight: line.weight ?? 1 });
				bookIndex.set(key, list);
				p.make(m);
			}
		}
	}
	return bookIndex.get(bookKey(pos)) ?? [];
}

/** The name of the opening this position belongs to (the longest book line it is on), or null. */
const FIRST_MOVE = {
	e4: "King's Pawn Opening",
	d4: "Queen's Pawn Opening",
	c4: "English Opening",
	Nf3: "Réti Opening",
};
export function openingName(game) {
	if (
		game.startFen.split(" ")[0] !==
		"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
	)
		return null;
	const sans = game.history.map((h) => h.san.replace(/[+#]$/, ""));
	if (!sans.length) return null;
	let name = null;
	let bestLen = 0;
	const families = new Set();
	for (const line of BOOK) {
		const moves = line.moves.split(" ").map((m) => m.replace(/[+#]$/, ""));
		let n = 0;
		while (n < moves.length && n < sans.length && moves[n] === sans[n]) n++;
		// the whole line was played: its name, the longest one wins
		if (n === moves.length && n > bestLen) {
			bestLen = n;
			name = line.name;
		}
		// still inside this line
		if (n === sans.length) families.add(line.name.split(":")[0]);
	}
	if (name) return name;
	// inside several lines of one family (Sicilian Defence, say): the family
	if (families.size === 1) return [...families][0];
	return sans.length <= 4 ? (FIRST_MOVE[sans[0]] ?? null) : null;
}

function weighted(list, rand) {
	const total = list.reduce((a, x) => a + x.weight, 0);
	let r = rand() * total;
	for (const x of list) {
		r -= x.weight;
		if (r <= 0) return x;
	}
	return list[list.length - 1];
}

/**
 * Choose the move a level plays. `pos` is the game's position (history included, for
 * repetitions). Returns { move, score, depth, pv, book }.
 */
export function chooseMove(
	engine,
	pos,
	levelId,
	{ ms, rand = Math.random, onInfo } = {},
) {
	const level = LEVELS[levelId] ?? LEVELS.medium;
	const plies = pos.full * 2 - (pos.turn ? 1 : 2);
	if (plies < level.book) {
		const book = bookMoves(pos);
		if (book.length) {
			const pick = weighted(book, rand);
			return {
				move: pick.move,
				score: 0,
				depth: 0,
				pv: [pick.move],
				book: true,
			};
		}
	}
	if (level.ms) {
		const r = engine.search(pos, {
			depth: level.depth,
			ms: Math.min(level.ms, ms ?? level.ms),
			onInfo,
		});
		return { ...r, book: false };
	}
	// the human-like levels: every move scored, then a choice that favours, but does not always take, the best
	const scored = engine.rootScores(pos, level.depth, level.quiesce);
	if (!scored.length) return { move: 0, score: 0, depth: 0, pv: [] };
	const top = scored[0].score;
	// a mate it can see, it plays (even a beginner spots mate in one)
	if (top >= MATE - MAX_PLY)
		return {
			move: scored[0].move,
			score: top,
			depth: level.depth,
			pv: [scored[0].move],
		};
	let pool = scored;
	if (rand() < level.blunder) {
		// the occasional slip: any move that does not lose on the spot to a mate it can see
		pool = scored.filter((x) => x.score > -(MATE - MAX_PLY));
		const pick = pool[Math.floor(rand() * pool.length)] ?? scored[0];
		return {
			move: pick.move,
			score: pick.score,
			depth: level.depth,
			pv: [pick.move],
		};
	}
	const t = level.temperature;
	const weights = pool.map((x) => ({
		...x,
		weight: Math.exp(Math.max(-30, (x.score - top) / t)),
	}));
	const pick = weighted(weights, rand);
	return {
		move: pick.move,
		score: pick.score,
		depth: level.depth,
		pv: [pick.move],
	};
}

/** A position from a start FEN and UCI moves, with its history (so repetitions count). */
export function positionFrom(fen, moves = []) {
	const pos = new Position(fen);
	for (const u of moves) {
		const m = pos.parse(u);
		if (!m) throw new Error(`The move ${u} is not legal.`);
		pos.make(m);
	}
	return pos;
}

/** A move as UCI text. */
export const uci = (m) =>
	sqName(moveFrom(m)) +
	sqName(moveTo(m)) +
	(movePromo(m) ? " pnbrqk"[movePromo(m)] : "");
