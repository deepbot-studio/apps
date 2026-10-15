/*
 * PIECE VALUES AND PIECE-SQUARE TABLES: what a piece is worth, and how much better it stands on one
 * square than another, once for the middlegame and once for the endgame. Written for this app from
 * plain chess principles (knights and bishops want the centre, rooks the seventh rank and open
 * files, the king hides in the middlegame and walks to the centre in the endgame, pawns are worth
 * more the closer they get to promoting), not copied from any engine.
 *
 * The tables are built into one flat array indexed piece * 128 + square (0x88 squares), with the
 * material already added and black's values negated, so a position's score is a plain sum the
 * board keeps up to date as pieces move.
 */

export const VALUE_MG = [0, 100, 320, 335, 480, 950, 0];
export const VALUE_EG = [0, 125, 300, 320, 530, 980, 0];
/** How much each piece counts toward "still a middlegame": 24 with every piece on, 0 with none. */
export const PHASE = [0, 0, 1, 1, 2, 4, 0];

// distance from the four centre squares: 0 in the centre, 3 in a corner
const edge = (f, r) =>
	Math.max(Math.abs(2 * f - 7), Math.abs(2 * r - 7)) / 2 - 0.5;
const centre = (f, r) => 3 - edge(f, r);

/** Bonus for a white piece of this type on file f, rank r (both 0-7, rank 0 = white's back rank). */
function bonus(type, f, r, end) {
	switch (type) {
		case 1: {
			// pawns
			if (r === 0 || r === 7) return 0;
			if (end) return [0, 0, 6, 14, 28, 50, 85, 0][r];
			let v = [0, 0, 3, 8, 16, 30, 55, 0][r];
			const central = f === 3 || f === 4;
			const near = f === 2 || f === 5;
			if (central) v += [0, -12, 4, 18, 18, 10, 0, 0][r];
			else if (near) v += [0, -2, 4, 8, 8, 4, 0, 0][r];
			// the pawns in front of a castled king are better left at home
			if ((f <= 1 || f >= 6) && r === 1) v += 6;
			if ((f <= 1 || f >= 6) && r >= 3 && r <= 4) v -= 4;
			return v;
		}
		case 2: {
			// knights: the centre, and never the rim
			const v = Math.round(centre(f, r) * 10 - 18);
			return end
				? Math.round(v * 0.8)
				: v + (r === 0 ? -8 : 0) + (r >= 4 && r <= 5 ? 6 : 0);
		}
		case 3: {
			// bishops: long diagonals and the centre, not the back rank
			const diag = f === r || f === 7 - r ? 6 : 0;
			const v = Math.round(centre(f, r) * 5 - 8) + diag;
			return end ? Math.round(centre(f, r) * 4 - 6) : v + (r === 0 ? -8 : 0);
		}
		case 4: {
			// rooks: the seventh rank, the central files, not the a/h files in the middlegame
			if (end) return r === 6 ? 12 : 0;
			let v = 0;
			if (r === 6) v += 22;
			if (f === 3 || f === 4) v += 6;
			else if (f === 2 || f === 5) v += 2;
			else if (f === 0 || f === 7) v -= 3;
			return v;
		}
		case 5: {
			// queens: a little centre, and not out too early
			const v = Math.round(centre(f, r) * 3 - 5);
			return end ? Math.round(centre(f, r) * 6 - 10) : v - (r >= 4 ? 4 : 0);
		}
		case 6: {
			// the king: tucked away while the queens are on, in the middle once they are off
			if (end) return Math.round(centre(f, r) * 12 - 22);
			const back = [22, 30, 12, -4, -4, 12, 30, 22][f];
			if (r === 0) return back;
			if (r === 1) return [8, 6, -8, -20, -20, -8, 6, 8][f];
			return -30 - 12 * (r - 2);
		}
	}
	return 0;
}

export const PST_MG = new Int16Array(16 * 128);
export const PST_EG = new Int16Array(16 * 128);

for (let type = 1; type <= 6; type++)
	for (let r = 0; r < 8; r++)
		for (let f = 0; f < 8; f++) {
			const sq = r * 16 + f;
			// white on (f, r); black is the same seen from the other side
			const black = (7 - r) * 16 + f;
			const mg = VALUE_MG[type] + bonus(type, f, r, false);
			const eg = VALUE_EG[type] + bonus(type, f, r, true);
			PST_MG[type * 128 + sq] = mg;
			PST_EG[type * 128 + sq] = eg;
			PST_MG[(8 | type) * 128 + black] = -mg;
			PST_EG[(8 | type) * 128 + black] = -eg;
		}
