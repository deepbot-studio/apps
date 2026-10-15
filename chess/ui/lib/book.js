/*
 * THE OPENING BOOK: main lines of the openings people actually meet, with their names. The engine
 * plays from it early in a game (so a game does not start the same way every time), the board
 * names the opening as it is played, and the Openings lessons walk through it. Weights are how
 * often the engine picks a line.
 */
export const BOOK = [
	{
		name: "Italian Game",
		moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O",
		weight: 6,
	},
	{
		name: "Italian Game: Two Knights Defence",
		moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O",
		weight: 4,
	},
	{
		name: "Italian Game: Evans Gambit",
		moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4",
		weight: 1,
	},
	{
		name: "Ruy Lopez",
		moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O",
		weight: 6,
	},
	{
		name: "Ruy Lopez: Berlin Defence",
		moves: "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5",
		weight: 2,
	},
	{
		name: "Ruy Lopez: Exchange Variation",
		moves: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6",
		weight: 1,
	},
	{
		name: "Scotch Game",
		moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7",
		weight: 2,
	},
	{
		name: "Four Knights Game",
		moves: "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3",
		weight: 2,
	},
	{
		name: "Petrov's Defence",
		moves: "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3",
		weight: 2,
	},
	{
		name: "Philidor Defence",
		moves: "e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7",
		weight: 1,
	},
	{ name: "King's Gambit", moves: "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5", weight: 1 },
	{
		name: "Vienna Game",
		moves: "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3",
		weight: 1,
	},
	{
		name: "Sicilian Defence: Najdorf",
		moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6",
		weight: 5,
	},
	{
		name: "Sicilian Defence: Dragon",
		moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6",
		weight: 2,
	},
	{
		name: "Sicilian Defence: Classical",
		moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Bg5 e6 Qd2",
		weight: 2,
	},
	{
		name: "Sicilian Defence: Taimanov",
		moves: "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be2 a6 O-O Nf6",
		weight: 2,
	},
	{
		name: "Sicilian Defence: Alapin",
		moves: "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6",
		weight: 2,
	},
	{
		name: "Sicilian Defence: Closed",
		moves: "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6",
		weight: 1,
	},
	{
		name: "French Defence",
		moves: "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7",
		weight: 3,
	},
	{
		name: "French Defence: Advance Variation",
		moves: "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3",
		weight: 2,
	},
	{
		name: "French Defence: Winawer",
		moves: "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7",
		weight: 1,
	},
	{
		name: "Caro-Kann Defence",
		moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7",
		weight: 3,
	},
	{
		name: "Caro-Kann Defence: Advance Variation",
		moves: "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O",
		weight: 2,
	},
	{
		name: "Pirc Defence",
		moves: "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O",
		weight: 1,
	},
	{
		name: "Scandinavian Defence",
		moves: "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6",
		weight: 2,
	},
	{
		name: "Alekhine's Defence",
		moves: "e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O",
		weight: 1,
	},
	{
		name: "Queen's Gambit Declined",
		moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6",
		weight: 5,
	},
	{
		name: "Queen's Gambit Accepted",
		moves: "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6",
		weight: 2,
	},
	{
		name: "Slav Defence",
		moves: "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O",
		weight: 3,
	},
	{
		name: "Semi-Slav Defence",
		moves: "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5",
		weight: 2,
	},
	{
		name: "London System",
		moves: "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3",
		weight: 3,
	},
	{
		name: "King's Indian Defence",
		moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7",
		weight: 4,
	},
	{
		name: "Grünfeld Defence",
		moves: "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5",
		weight: 2,
	},
	{
		name: "Nimzo-Indian Defence",
		moves: "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O",
		weight: 3,
	},
	{
		name: "Queen's Indian Defence",
		moves: "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7",
		weight: 2,
	},
	{
		name: "Catalan Opening",
		moves: "d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6",
		weight: 2,
	},
	{
		name: "Benoni Defence",
		moves: "d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7",
		weight: 1,
	},
	{
		name: "Dutch Defence",
		moves: "d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6",
		weight: 1,
	},
	{
		name: "English Opening",
		moves: "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7",
		weight: 3,
	},
	{
		name: "English Opening: Symmetrical",
		moves: "c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O",
		weight: 1,
	},
	{
		name: "Réti Opening",
		moves: "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O",
		weight: 2,
	},
	{
		name: "Réti Opening: King's Indian Attack",
		moves: "Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O d3 d6 e4 e5",
		weight: 1,
	},
];
