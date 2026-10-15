/*
 * THE RULES OF CHESS, written for this app: the board, every legal move (castling, en passant,
 * promotion), check, mate, stalemate, the draws (threefold repetition, fifty moves, not enough
 * material), FEN, SAN and PGN.
 *
 * Two layers. `Position` is the fast one the engine searches with: a 0x88 board, moves packed into
 * integers, make/unmake on typed-array stacks, a Zobrist hash and the piece-square score kept up to
 * date as pieces move. `Game` is the friendly one the interface uses: moves as objects with SAN,
 * history, undo, the game's result, PGN in and out.
 *
 * Squares are 0x88 numbers (rank * 16 + file, a1 = 0, h8 = 119); `sqName` / `sqParse` turn them into
 * "e4" and back. Pieces are 1-6 (pawn, knight, bishop, rook, queen, king) plus 8 for black.
 */
import { PHASE, PST_EG, PST_MG } from "./pst.js";

export const WHITE = 0;
export const BLACK = 1;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const F_CAPTURE = 1;
export const F_EP = 2;
export const F_CASTLE = 4;
export const F_DOUBLE = 8;

export const moveFrom = (m) => m & 127;
export const moveTo = (m) => (m >> 7) & 127;
export const movePromo = (m) => (m >> 14) & 7;
export const moveFlags = (m) => m >>> 17;
export const pack = (from, to, promo = 0, flags = 0) =>
	from | (to << 7) | (promo << 14) | (flags << 17);

export const sqName = (s) => "abcdefgh"[s & 7] + ((s >> 4) + 1);
export function sqParse(name) {
	if (typeof name !== "string" || !/^[a-h][1-8]$/.test(name)) return -1;
	return (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
}
/** 0x88 square to 0-63 (a1 = 0) and back. */
export const to64 = (s) => (s >> 4) * 8 + (s & 7);
export const from64 = (i) => (i >> 3) * 16 + (i & 7);

const N_D = [33, 31, 18, 14, -33, -31, -18, -14];
const B_D = [17, 15, -17, -15];
const R_D = [16, 1, -16, -1];
const K_D = [17, 15, -17, -15, 16, 1, -16, -1];
const LETTER = " pnbrqk";

// castling rights lost when a piece leaves or arrives on a square (a1, h1, e1, a8, h8, e8)
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0] = 15 & ~2;
CASTLE_MASK[7] = 15 & ~1;
CASTLE_MASK[4] = 15 & ~3;
CASTLE_MASK[0x70] = 15 & ~8;
CASTLE_MASK[0x77] = 15 & ~4;
CASTLE_MASK[0x74] = 15 & ~12;

// Zobrist keys, two 32-bit halves, from a fixed seed so a position always hashes the same
let seed = 0x2f6b9a1d;
const rnd = () => {
	seed ^= seed << 13;
	seed ^= seed >>> 17;
	seed ^= seed << 5;
	return seed | 0;
};
const ZP_LO = new Int32Array(16 * 128);
const ZP_HI = new Int32Array(16 * 128);
for (let i = 0; i < ZP_LO.length; i++) {
	ZP_LO[i] = rnd();
	ZP_HI[i] = rnd();
}
const ZC_LO = Int32Array.from({ length: 16 }, rnd);
const ZC_HI = Int32Array.from({ length: 16 }, rnd);
const ZE_LO = Int32Array.from({ length: 8 }, rnd);
const ZE_HI = Int32Array.from({ length: 8 }, rnd);
const ZS_LO = rnd();
const ZS_HI = rnd();

export class Position {
	constructor(fen = START) {
		this.board = new Int8Array(128);
		this.kings = [4, 0x74];
		this.size = 0;
		this.grow(1024);
		this.load(fen);
	}

	grow(n) {
		const keep = this.size;
		const make = (Type, old) => {
			const a = new Type(n);
			if (old) a.set(old.subarray(0, keep));
			return a;
		};
		this.uCap = make(Int8Array, this.uCap);
		this.uCastle = make(Uint8Array, this.uCastle);
		this.uEp = make(Int16Array, this.uEp);
		this.uHalf = make(Int16Array, this.uHalf);
		this.uMg = make(Int32Array, this.uMg);
		this.uEg = make(Int32Array, this.uEg);
		this.uPhase = make(Int8Array, this.uPhase);
		this.uKing = make(Int16Array, this.uKing);
		this.hLo = make(Int32Array, this.hLo);
		this.hHi = make(Int32Array, this.hHi);
		this.size = n;
	}

	/** Load a FEN; throws an Error that says what is wrong with it. */
	load(fen) {
		const parts = String(fen).trim().split(/\s+/);
		if (parts.length < 4) throw new Error("A FEN needs at least four fields.");
		const rows = parts[0].split("/");
		if (rows.length !== 8) throw new Error("A FEN board needs eight ranks.");
		const b = this.board;
		b.fill(0);
		const kings = [-1, -1];
		const count = [0, 0];
		for (let i = 0; i < 8; i++) {
			const rank = 7 - i;
			let file = 0;
			for (const ch of rows[i]) {
				if (ch >= "1" && ch <= "8") file += Number(ch);
				else {
					const type = LETTER.indexOf(ch.toLowerCase());
					if (type < 1 || file > 7)
						throw new Error(`"${rows[i]}" is not a valid rank.`);
					const colour = ch === ch.toLowerCase() ? BLACK : WHITE;
					const sq = rank * 16 + file;
					b[sq] = (colour << 3) | type;
					if (type === KING) {
						count[colour]++;
						kings[colour] = sq;
					}
					file++;
				}
			}
			if (file !== 8) throw new Error(`"${rows[i]}" does not fill a rank.`);
		}
		if (count[0] !== 1 || count[1] !== 1)
			throw new Error("Each side needs exactly one king.");
		this.kings = kings;
		if (parts[1] !== "w" && parts[1] !== "b")
			throw new Error("The side to move must be w or b.");
		this.turn = parts[1] === "w" ? WHITE : BLACK;
		let castle = 0;
		if (parts[2] !== "-")
			for (const ch of parts[2]) {
				const bit = "KQkq".indexOf(ch);
				if (bit < 0)
					throw new Error("Castling rights must be made of K, Q, k and q.");
				castle |= 1 << bit;
			}
		// rights the pieces could not have any more are dropped, as other programs do
		if (b[4] !== 6) castle &= ~3;
		if (b[7] !== 4) castle &= ~1;
		if (b[0] !== 4) castle &= ~2;
		if (b[0x74] !== 14) castle &= ~12;
		if (b[0x77] !== 12) castle &= ~4;
		if (b[0x70] !== 12) castle &= ~8;
		this.castle = castle;
		this.ep = parts[3] === "-" ? -1 : sqParse(parts[3]);
		if (parts[3] !== "-" && this.ep < 0)
			throw new Error("The en passant square is not a square.");
		if (this.ep >= 0 && !this.epUseful(this.ep)) this.ep = -1;
		this.half = Number.parseInt(parts[4] ?? "0", 10) || 0;
		this.full = Math.max(1, Number.parseInt(parts[5] ?? "1", 10) || 1);
		this.ply = 0;
		this.rehash();
		if (this.attacked(this.kings[this.turn ^ 1], this.turn))
			throw new Error("The side not to move is in check.");
		return this;
	}

	/** Can a pawn of the side to move actually take on this en passant square? */
	epUseful(ep) {
		const us = this.turn;
		const from = ep + (us === WHITE ? -16 : 16);
		const p = (us << 3) | PAWN;
		const a = from - 1;
		const c = from + 1;
		return (
			(!(a & 0x88) && this.board[a] === p) ||
			(!(c & 0x88) && this.board[c] === p)
		);
	}

	rehash() {
		let lo = 0;
		let hi = 0;
		let mg = 0;
		let eg = 0;
		let phase = 0;
		for (let s = 0; s < 128; s++) {
			if (s & 0x88) {
				s += 7;
				continue;
			}
			const p = this.board[s];
			if (!p) continue;
			lo ^= ZP_LO[p * 128 + s];
			hi ^= ZP_HI[p * 128 + s];
			mg += PST_MG[p * 128 + s];
			eg += PST_EG[p * 128 + s];
			phase += PHASE[p & 7];
		}
		lo ^= ZC_LO[this.castle];
		hi ^= ZC_HI[this.castle];
		if (this.ep >= 0) {
			lo ^= ZE_LO[this.ep & 7];
			hi ^= ZE_HI[this.ep & 7];
		}
		if (this.turn) {
			lo ^= ZS_LO;
			hi ^= ZS_HI;
		}
		this.lo = lo;
		this.hi = hi;
		this.mg = mg;
		this.eg = eg;
		this.phase = phase;
		this.hLo[this.ply] = lo;
		this.hHi[this.ply] = hi;
	}

	fen() {
		const b = this.board;
		const rows = [];
		for (let r = 7; r >= 0; r--) {
			let row = "";
			let empty = 0;
			for (let f = 0; f < 8; f++) {
				const p = b[r * 16 + f];
				if (!p) empty++;
				else {
					if (empty) row += empty;
					empty = 0;
					const ch = LETTER[p & 7];
					row += p & 8 ? ch : ch.toUpperCase();
				}
			}
			if (empty) row += empty;
			rows.push(row);
		}
		let castle = "";
		if (this.castle & 1) castle += "K";
		if (this.castle & 2) castle += "Q";
		if (this.castle & 4) castle += "k";
		if (this.castle & 8) castle += "q";
		return `${rows.join("/")} ${this.turn ? "b" : "w"} ${castle || "-"} ${this.ep >= 0 ? sqName(this.ep) : "-"} ${this.half} ${this.full}`;
	}

	/** Is square `sq` attacked by side `by`? */
	attacked(sq, by) {
		const b = this.board;
		let f;
		if (by === WHITE) {
			f = sq - 15;
			if (!(f & 0x88) && b[f] === 1) return true;
			f = sq - 17;
			if (!(f & 0x88) && b[f] === 1) return true;
		} else {
			f = sq + 15;
			if (!(f & 0x88) && b[f] === 9) return true;
			f = sq + 17;
			if (!(f & 0x88) && b[f] === 9) return true;
		}
		const c = by << 3;
		const knight = c | KNIGHT;
		for (let i = 0; i < 8; i++) {
			f = sq + N_D[i];
			if (!(f & 0x88) && b[f] === knight) return true;
		}
		const king = c | KING;
		for (let i = 0; i < 8; i++) {
			f = sq + K_D[i];
			if (!(f & 0x88) && b[f] === king) return true;
		}
		const bishop = c | BISHOP;
		const rook = c | ROOK;
		const queen = c | QUEEN;
		for (let i = 0; i < 4; i++) {
			const d = B_D[i];
			f = sq + d;
			while (!(f & 0x88)) {
				const p = b[f];
				if (p) {
					if (p === bishop || p === queen) return true;
					break;
				}
				f += d;
			}
		}
		for (let i = 0; i < 4; i++) {
			const d = R_D[i];
			f = sq + d;
			while (!(f & 0x88)) {
				const p = b[f];
				if (p) {
					if (p === rook || p === queen) return true;
					break;
				}
				f += d;
			}
		}
		return false;
	}

	inCheck(side = this.turn) {
		return this.attacked(this.kings[side], side ^ 1);
	}

	/**
	 * Pseudo-legal moves (a move may leave the king in check: `make` it and ask `leftInCheck`) into
	 * `out` from index `n`; returns the new end. `all` false: only captures and queen promotions.
	 */
	gen(out, n = 0, all = true) {
		const b = this.board;
		const us = this.turn;
		const them = us ^ 1;
		for (let s = 0; s < 128; s++) {
			if (s & 0x88) {
				s += 7;
				continue;
			}
			const p = b[s];
			if (!p || p >> 3 !== us) continue;
			const type = p & 7;
			if (type === PAWN) {
				const up = us ? -16 : 16;
				const last = us ? 0 : 7;
				const t1 = s + up;
				if (!(t1 & 0x88) && !b[t1]) {
					if (t1 >> 4 === last) {
						out[n++] = pack(s, t1, QUEEN);
						if (all) {
							out[n++] = pack(s, t1, KNIGHT);
							out[n++] = pack(s, t1, ROOK);
							out[n++] = pack(s, t1, BISHOP);
						}
					} else if (all) {
						out[n++] = pack(s, t1);
						const t2 = t1 + up;
						if (s >> 4 === (us ? 6 : 1) && !b[t2])
							out[n++] = pack(s, t2, 0, F_DOUBLE);
					}
				}
				for (let side = -1; side <= 1; side += 2) {
					const t = t1 + side;
					if (t & 0x88) continue;
					const q = b[t];
					if (q && q >> 3 === them) {
						if (t >> 4 === last) {
							out[n++] = pack(s, t, QUEEN, F_CAPTURE);
							if (all) {
								out[n++] = pack(s, t, KNIGHT, F_CAPTURE);
								out[n++] = pack(s, t, ROOK, F_CAPTURE);
								out[n++] = pack(s, t, BISHOP, F_CAPTURE);
							}
						} else out[n++] = pack(s, t, 0, F_CAPTURE);
					} else if (t === this.ep) out[n++] = pack(s, t, 0, F_CAPTURE | F_EP);
				}
			} else if (type === KNIGHT || type === KING) {
				const ds = type === KNIGHT ? N_D : K_D;
				for (let i = 0; i < 8; i++) {
					const t = s + ds[i];
					if (t & 0x88) continue;
					const q = b[t];
					if (!q) {
						if (all) out[n++] = pack(s, t);
					} else if (q >> 3 === them) out[n++] = pack(s, t, 0, F_CAPTURE);
				}
				if (type === KING && all && this.castle) {
					if (us === WHITE && s === 4) {
						if (
							this.castle & 1 &&
							!b[5] &&
							!b[6] &&
							!this.attacked(4, them) &&
							!this.attacked(5, them) &&
							!this.attacked(6, them)
						)
							out[n++] = pack(4, 6, 0, F_CASTLE);
						if (
							this.castle & 2 &&
							!b[3] &&
							!b[2] &&
							!b[1] &&
							!this.attacked(4, them) &&
							!this.attacked(3, them) &&
							!this.attacked(2, them)
						)
							out[n++] = pack(4, 2, 0, F_CASTLE);
					} else if (us === BLACK && s === 0x74) {
						if (
							this.castle & 4 &&
							!b[0x75] &&
							!b[0x76] &&
							!this.attacked(0x74, them) &&
							!this.attacked(0x75, them) &&
							!this.attacked(0x76, them)
						)
							out[n++] = pack(0x74, 0x76, 0, F_CASTLE);
						if (
							this.castle & 8 &&
							!b[0x73] &&
							!b[0x72] &&
							!b[0x71] &&
							!this.attacked(0x74, them) &&
							!this.attacked(0x73, them) &&
							!this.attacked(0x72, them)
						)
							out[n++] = pack(0x74, 0x72, 0, F_CASTLE);
					}
				}
			} else {
				const ds = type === BISHOP ? B_D : type === ROOK ? R_D : K_D;
				const len = type === QUEEN ? 8 : 4;
				for (let i = 0; i < len; i++) {
					const d = ds[i];
					let t = s + d;
					while (!(t & 0x88)) {
						const q = b[t];
						if (!q) {
							if (all) out[n++] = pack(s, t);
						} else {
							if (q >> 3 === them) out[n++] = pack(s, t, 0, F_CAPTURE);
							break;
						}
						t += d;
					}
				}
			}
		}
		return n;
	}

	put(sq, p) {
		this.board[sq] = p;
		const i = p * 128 + sq;
		this.lo ^= ZP_LO[i];
		this.hi ^= ZP_HI[i];
		this.mg += PST_MG[i];
		this.eg += PST_EG[i];
		this.phase += PHASE[p & 7];
	}

	take(sq) {
		const p = this.board[sq];
		this.board[sq] = 0;
		const i = p * 128 + sq;
		this.lo ^= ZP_LO[i];
		this.hi ^= ZP_HI[i];
		this.mg -= PST_MG[i];
		this.eg -= PST_EG[i];
		this.phase -= PHASE[p & 7];
		return p;
	}

	/** Play a move (pseudo-legal is fine); `unmake` with the same move takes it back. */
	make(m) {
		const k = this.ply;
		if (k + 2 >= this.size) this.grow(this.size * 2);
		const from = m & 127;
		const to = (m >> 7) & 127;
		const promo = (m >> 14) & 7;
		const fl = m >>> 17;
		const us = this.turn;
		this.uCastle[k] = this.castle;
		this.uEp[k] = this.ep;
		this.uHalf[k] = this.half;
		this.uMg[k] = this.mg;
		this.uEg[k] = this.eg;
		this.uPhase[k] = this.phase;
		this.uKing[k] = this.kings[us];
		let cap = 0;
		if (fl & F_EP) cap = this.take(to + (us ? 16 : -16));
		else if (this.board[to]) cap = this.take(to);
		this.uCap[k] = cap;
		const p = this.take(from);
		this.put(to, promo ? (us << 3) | promo : p);
		if (fl & F_CASTLE) {
			if (to === 6) this.put(5, this.take(7));
			else if (to === 2) this.put(3, this.take(0));
			else if (to === 0x76) this.put(0x75, this.take(0x77));
			else this.put(0x73, this.take(0x70));
		}
		if ((p & 7) === KING) this.kings[us] = to;
		const castle = this.castle & CASTLE_MASK[from] & CASTLE_MASK[to];
		if (castle !== this.castle) {
			this.lo ^= ZC_LO[this.castle] ^ ZC_LO[castle];
			this.hi ^= ZC_HI[this.castle] ^ ZC_HI[castle];
			this.castle = castle;
		}
		if (this.ep >= 0) {
			this.lo ^= ZE_LO[this.ep & 7];
			this.hi ^= ZE_HI[this.ep & 7];
		}
		this.ep = -1;
		this.turn = us ^ 1;
		if (fl & F_DOUBLE) {
			const ep = (from + to) >> 1;
			if (this.epUseful(ep)) {
				this.ep = ep;
				this.lo ^= ZE_LO[ep & 7];
				this.hi ^= ZE_HI[ep & 7];
			}
		}
		this.lo ^= ZS_LO;
		this.hi ^= ZS_HI;
		this.half = (p & 7) === PAWN || cap ? 0 : this.half + 1;
		if (us === BLACK) this.full++;
		this.ply = k + 1;
		this.hLo[k + 1] = this.lo;
		this.hHi[k + 1] = this.hi;
	}

	unmake(m) {
		const k = --this.ply;
		const from = m & 127;
		const to = (m >> 7) & 127;
		const promo = (m >> 14) & 7;
		const fl = m >>> 17;
		const us = this.turn ^ 1;
		const b = this.board;
		this.turn = us;
		const moved = promo ? (us << 3) | PAWN : b[to];
		b[to] = 0;
		b[from] = moved;
		const cap = this.uCap[k];
		if (fl & F_EP) b[to + (us ? 16 : -16)] = cap;
		else if (cap) b[to] = cap;
		if (fl & F_CASTLE) {
			if (to === 6) {
				b[7] = b[5];
				b[5] = 0;
			} else if (to === 2) {
				b[0] = b[3];
				b[3] = 0;
			} else if (to === 0x76) {
				b[0x77] = b[0x75];
				b[0x75] = 0;
			} else {
				b[0x70] = b[0x73];
				b[0x73] = 0;
			}
		}
		this.kings[us] = this.uKing[k];
		this.castle = this.uCastle[k];
		this.ep = this.uEp[k];
		this.half = this.uHalf[k];
		this.mg = this.uMg[k];
		this.eg = this.uEg[k];
		this.phase = this.uPhase[k];
		this.lo = this.hLo[k];
		this.hi = this.hHi[k];
		if (us === BLACK) this.full--;
	}

	/** Pass the move (the engine's null-move pruning). */
	makeNull() {
		const k = this.ply;
		if (k + 2 >= this.size) this.grow(this.size * 2);
		this.uEp[k] = this.ep;
		this.uHalf[k] = this.half;
		if (this.ep >= 0) {
			this.lo ^= ZE_LO[this.ep & 7];
			this.hi ^= ZE_HI[this.ep & 7];
		}
		this.ep = -1;
		this.turn ^= 1;
		this.lo ^= ZS_LO;
		this.hi ^= ZS_HI;
		this.half = 0;
		this.ply = k + 1;
		this.hLo[k + 1] = this.lo;
		this.hHi[k + 1] = this.hi;
	}

	unmakeNull() {
		const k = --this.ply;
		this.turn ^= 1;
		this.ep = this.uEp[k];
		this.half = this.uHalf[k];
		this.lo = this.hLo[k];
		this.hi = this.hHi[k];
	}

	/** After `make`: did the side that just moved leave its own king in check? */
	leftInCheck() {
		const moved = this.turn ^ 1;
		return this.attacked(this.kings[moved], this.turn);
	}

	/** How many times this position has stood before (same side to move, same rights). */
	repeats() {
		let n = 0;
		const stop = Math.max(0, this.ply - this.half);
		for (let i = this.ply - 2; i >= stop; i -= 2)
			if (this.hLo[i] === this.lo && this.hHi[i] === this.hi) n++;
		return n;
	}

	/** Neither side can possibly mate: K v K, K+minor v K, K+B v K+B with bishops on one colour. */
	insufficient() {
		const b = this.board;
		let minors = 0;
		const bishops = [];
		for (let s = 0; s < 128; s++) {
			if (s & 0x88) {
				s += 7;
				continue;
			}
			const t = b[s] & 7;
			if (!t || t === KING) continue;
			if (t === PAWN || t === ROOK || t === QUEEN) return false;
			minors++;
			if (t === BISHOP) bishops.push(((s >> 4) + (s & 7)) & 1);
		}
		if (minors <= 1) return true;
		return bishops.length === minors && bishops.every((c) => c === bishops[0]);
	}

	/** Every legal move. */
	legal() {
		const buf = new Int32Array(256);
		const n = this.gen(buf, 0, true);
		const out = [];
		for (let i = 0; i < n; i++) {
			const m = buf[i];
			this.make(m);
			if (!this.leftInCheck()) out.push(m);
			this.unmake(m);
		}
		return out;
	}

	hasLegal() {
		const buf = new Int32Array(256);
		const n = this.gen(buf, 0, true);
		for (let i = 0; i < n; i++) {
			const m = buf[i];
			this.make(m);
			const ok = !this.leftInCheck();
			this.unmake(m);
			if (ok) return true;
		}
		return false;
	}

	/** SAN for a legal move, with + or #. `legal` may be passed to save generating it again. */
	san(m, legal = this.legal()) {
		const from = moveFrom(m);
		const to = moveTo(m);
		const fl = moveFlags(m);
		const type = this.board[from] & 7;
		let s;
		if (fl & F_CASTLE) s = (to & 7) === 6 ? "O-O" : "O-O-O";
		else {
			const capture = fl & F_CAPTURE;
			if (type === PAWN)
				s = capture ? `${"abcdefgh"[from & 7]}x${sqName(to)}` : sqName(to);
			else {
				let file = false;
				let rank = false;
				let other = false;
				for (const o of legal) {
					if (o === m || moveTo(o) !== to || moveFrom(o) === from) continue;
					if ((this.board[moveFrom(o)] & 7) !== type) continue;
					other = true;
					if ((moveFrom(o) & 7) === (from & 7)) file = true;
					if (moveFrom(o) >> 4 === from >> 4) rank = true;
				}
				let dis = "";
				if (other) {
					if (!file) dis = "abcdefgh"[from & 7];
					else if (!rank) dis = String((from >> 4) + 1);
					else dis = sqName(from);
				}
				s =
					LETTER[type].toUpperCase() + dis + (capture ? "x" : "") + sqName(to);
			}
			const promo = movePromo(m);
			if (promo) s += `=${LETTER[promo].toUpperCase()}`;
		}
		this.make(m);
		if (this.inCheck()) s += this.hasLegal() ? "+" : "#";
		this.unmake(m);
		return s;
	}

	/** The legal move this SAN (or UCI like "e2e4", "e7e8q") stands for, or 0. Lenient about +, #, x, =, 0-0. */
	parse(text, legal = this.legal()) {
		let t = String(text)
			.trim()
			.replace(/[+#!?]+$/, "")
			.replace(/^(\d+\.+\s*)/, "");
		const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(t);
		if (uci) {
			const from = sqParse(uci[1]);
			const to = sqParse(uci[2]);
			const promo = uci[3] ? LETTER.indexOf(uci[3]) : 0;
			for (const m of legal) {
				if (moveFrom(m) !== from || moveTo(m) !== to) continue;
				// "e7e8" without a piece means a queen
				if (movePromo(m) === (promo || (movePromo(m) ? QUEEN : 0))) return m;
			}
			return 0;
		}
		t = t.replace(/0/g, "O");
		for (const m of legal) {
			const s = this.san(m, legal).replace(/[+#]$/, "");
			if (
				s === t ||
				s.replace("=", "") === t.replace("=", "") ||
				s.replace("x", "") === t.replace("x", "")
			)
				return m;
		}
		return 0;
	}
}

/** Count the leaf positions `depth` moves deep: the standard test that a move generator is right. */
export function perft(pos, depth) {
	if (depth === 0) return 1;
	const buf = new Int32Array(256);
	const n = pos.gen(buf, 0, true);
	let total = 0;
	for (let i = 0; i < n; i++) {
		const m = buf[i];
		pos.make(m);
		if (!pos.leftInCheck()) total += depth === 1 ? 1 : perft(pos, depth - 1);
		pos.unmake(m);
	}
	return total;
}

const PIECE_NAME = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
export const pieceName = (type) => PIECE_NAME[type];

/** A move as the interface sees it. */
function describe(pos, m, san) {
	const from = moveFrom(m);
	const to = moveTo(m);
	const fl = moveFlags(m);
	const p = pos.board[from];
	const captured = fl & F_EP ? (p ^ 8) & 15 : pos.board[to];
	return {
		m,
		from: sqName(from),
		to: sqName(to),
		colour: p >> 3 ? "b" : "w",
		piece: LETTER[p & 7],
		captured: captured ? LETTER[captured & 7] : null,
		promotion: movePromo(m) ? LETTER[movePromo(m)] : null,
		castle: fl & F_CASTLE ? ((to & 7) === 6 ? "king" : "queen") : null,
		enPassant: Boolean(fl & F_EP),
		san,
		uci: sqName(from) + sqName(to) + (movePromo(m) ? LETTER[movePromo(m)] : ""),
	};
}

/**
 * A game: a starting position, the moves played, and everything the interface asks about it.
 */
export class Game {
	constructor(fen = START) {
		this.reset(fen);
	}

	reset(fen = START) {
		this.pos = new Position(fen);
		this.startFen = this.pos.fen();
		this.history = [];
		this.fens = [this.startFen];
		this.headers = {};
		this.outcome = null; // set by resign / timeout / agreement: { result, reason }
		this._legal = null;
		return this;
	}

	fen() {
		return this.pos.fen();
	}

	get turn() {
		return this.pos.turn ? "b" : "w";
	}

	legalMoves() {
		if (!this._legal) {
			const legal = this.pos.legal();
			this._legal = legal.map((m) =>
				describe(this.pos, m, this.pos.san(m, legal)),
			);
		}
		return this._legal;
	}

	/** Legal moves from a square ("e2"). */
	movesFrom(square) {
		return this.legalMoves().filter((mv) => mv.from === square);
	}

	/** Play a move: {from, to, promotion}, SAN or UCI. Returns the move, or null if it is not legal. */
	move(input) {
		if (this.over()) return null;
		const legal = this.legalMoves();
		let mv = null;
		if (typeof input === "string") {
			const m = this.pos.parse(
				input,
				legal.map((x) => x.m),
			);
			mv = legal.find((x) => x.m === m) ?? null;
		} else if (input?.from && input.to) {
			const promo = input.promotion
				? String(input.promotion).toLowerCase()
				: null;
			mv =
				legal.find(
					(x) =>
						x.from === input.from &&
						x.to === input.to &&
						(x.promotion ?? null) === (x.promotion ? promo || "q" : null),
				) ?? null;
		}
		if (!mv) return null;
		this.pos.make(mv.m);
		this._legal = null;
		const fen = this.pos.fen();
		const played = {
			...mv,
			fen,
			ply: this.history.length + 1,
			check: this.pos.inCheck(),
		};
		this.history.push(played);
		this.fens.push(fen);
		return played;
	}

	undo() {
		const last = this.history.pop();
		if (!last) return null;
		this.pos.unmake(last.m);
		this.fens.pop();
		this._legal = null;
		this.outcome = null;
		return last;
	}

	inCheck() {
		return this.pos.inCheck();
	}

	/** The game's end, or null while it goes on: { result: "1-0" | "0-1" | "1/2-1/2", reason }. */
	over() {
		if (this.outcome) return this.outcome;
		const p = this.pos;
		if (!this.legalMoves().length) {
			if (p.inCheck())
				return { result: p.turn ? "1-0" : "0-1", reason: "checkmate" };
			return { result: "1/2-1/2", reason: "stalemate" };
		}
		if (p.insufficient())
			return { result: "1/2-1/2", reason: "insufficient material" };
		if (p.half >= 100) return { result: "1/2-1/2", reason: "fifty-move rule" };
		if (p.repeats() >= 2)
			return { result: "1/2-1/2", reason: "threefold repetition" };
		return null;
	}

	/** Resign, run out of time, agree a draw: `end("0-1", "White resigned")`. */
	end(result, reason) {
		this.outcome = { result, reason };
	}

	/** The board as 8 rows of 8 (rank 8 first), each square null or { type: "p", colour: "w" }. */
	board() {
		const rows = [];
		for (let r = 7; r >= 0; r--) {
			const row = [];
			for (let f = 0; f < 8; f++) {
				const p = this.pos.board[r * 16 + f];
				row.push(
					p
						? {
								type: LETTER[p & 7],
								colour: p & 8 ? "b" : "w",
								square: "abcdefgh"[f] + (r + 1),
							}
						: null,
				);
			}
			rows.push(row);
		}
		return rows;
	}

	pieceAt(square) {
		const s = sqParse(square);
		if (s < 0) return null;
		const p = this.pos.board[s];
		return p ? { type: LETTER[p & 7], colour: p & 8 ? "b" : "w" } : null;
	}

	/** The squares of the side-to-move's king when it is in check, else null. */
	checkSquare() {
		return this.pos.inCheck() ? sqName(this.pos.kings[this.pos.turn]) : null;
	}

	pgn({ headers = {} } = {}) {
		const over = this.over();
		const h = {
			Event: "Casual game",
			Site: "DeepBot Chess",
			Date: new Date().toISOString().slice(0, 10).replaceAll("-", "."),
			White: "White",
			Black: "Black",
			Result: over ? over.result : "*",
			...this.headers,
			...headers,
		};
		if (this.startFen !== START) {
			h.SetUp = "1";
			h.FEN = this.startFen;
		}
		const lines = Object.entries(h).map(
			([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`,
		);
		const startBlack = this.startFen.split(" ")[1] === "b";
		let num = Number(this.startFen.split(" ")[5]) || 1;
		const parts = [];
		this.history.forEach((mv, i) => {
			const white = startBlack ? i % 2 === 1 : i % 2 === 0;
			if (white) parts.push(`${num}. ${mv.san}`);
			else {
				parts.push(i === 0 ? `${num}... ${mv.san}` : mv.san);
				num++;
			}
		});
		parts.push(h.Result);
		const text = [];
		let line = "";
		for (const part of parts) {
			if (line && line.length + part.length + 1 > 80) {
				text.push(line);
				line = part;
			} else line = line ? `${line} ${part}` : part;
		}
		if (line) text.push(line);
		return `${lines.join("\n")}\n\n${text.join("\n")}\n`;
	}

	/** Load a PGN (the first game in it). Throws an Error naming the move that does not fit. */
	static fromPgn(text) {
		const src = String(text).replace(/\r/g, "");
		const headers = {};
		for (const m of src.matchAll(/^\[(\w+)\s+"([^"]*)"\]\s*$/gm))
			headers[m[1]] = m[2];
		let body = src.replace(/^\[.*\]\s*$/gm, " ");
		body = body.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ");
		// variations, nested
		let prev;
		do {
			prev = body;
			body = body.replace(/\([^()]*\)/g, " ");
		} while (body !== prev);
		body = body.replace(/\$\d+/g, " ");
		const game = new Game(headers.FEN || START);
		game.headers = headers;
		for (const raw of body.split(/\s+/)) {
			const tok = raw.replace(/^\d+\.(\.\.)?/, "");
			if (!tok || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
			if (!game.move(tok))
				throw new Error(
					`The move "${tok}" (move ${Math.floor(game.history.length / 2) + 1}) is not legal here.`,
				);
		}
		return game;
	}

	/** A copy of the game at ply n (0 = the start). */
	at(n) {
		const g = new Game(this.startFen);
		g.headers = { ...this.headers };
		for (const mv of this.history.slice(0, n)) g.move(mv.uci);
		return g;
	}
}
