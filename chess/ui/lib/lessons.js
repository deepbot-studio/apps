/*
 * THE LESSONS: chess from the very first move to ideas strong club players think about. Each
 * lesson is a short run of steps on a board: something to read (with arrows and marked squares),
 * then something to do. What a step can ask:
 *
 *   sandbox   move one piece around an empty board and capture every star (pieces with no kings,
 *             for learning how a piece moves)
 *   move      play one of the given moves (SAN or UCI)
 *   check     give check, any way
 *   mate      checkmate in one, any way
 *   line      play your side of an opening; the other side answers, with a note after each move
 *   best      find a good move: the engine checks it, so any move nearly as good as its own counts
 *   play      play the position out against the engine until a goal: mate, promote, win a pawn, hold
 *   puzzles   a few puzzles of one theme from the puzzle collection
 *   quiz      a question with choices
 *   go-play   start a real game (Play) at a level
 *
 * Positions are FEN; tests/lessons.test.ts checks every one, every move and every mate.
 */

export const COURSES = [
	{
		id: "basics",
		title: "The basics",
		level: "Never played",
		about:
			"The board, how every piece moves, check and checkmate, the special moves. From zero to your first game.",
		lessons: [
			{
				id: "board",
				title: "The board",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "Chess is played on a board of 64 squares, eight by eight, by two players: **White** and **Black**. Each starts with 16 pieces, set up like this. White always moves first, then the players take turns, one move each.",
					},
					{
						fen: "8/8/8/8/8/8/8/8 w - - 0 1",
						marks: { e4: "target" },
						say: "The columns are called **files** and are lettered **a** to **h**. The rows are **ranks**, numbered **1** to **8** from White's side. So every square has a name: the marked one is **e4**, file e, rank 4.",
					},
					{
						fen: "8/8/8/8/8/8/8/8 w - - 0 1",
						marks: { c6: "target" },
						say: "Your turn to read a square.",
						task: {
							type: "quiz",
							q: "What is the name of the marked square?",
							options: ["c6", "f3", "c3", "f6"],
							answer: 0,
							explain: "File c (third from the left), rank 6.",
						},
					},
					{
						fen: "8/8/8/8/8/8/8/8 w - - 0 1",
						say: "One more thing about the board: each player has a **light square in the right-hand corner**. If the board is turned the wrong way, that's how you notice.",
						marks: { h1: "good", a8: "good" },
					},
				],
			},
			{
				id: "rook",
				title: "The rook",
				steps: [
					{
						fen: "8/8/8/8/3R4/8/8/8 w - - 0 1",
						arrows: ["d4d8", "d4d1", "d4a4", "d4h4"],
						say: "The **rook** moves in a straight line: up, down, left or right, as many squares as it likes. It cannot jump over anything in its way.",
					},
					{
						say: "Capture every star with the rook. Stars are enemy pieces: moving onto one takes it off the board.",
						task: {
							type: "sandbox",
							piece: "wr",
							from: "a1",
							stars: ["a7", "f7", "f2"],
							par: 3,
						},
					},
					{
						say: "Now there are pieces of your own in the way. The rook cannot jump over them.",
						task: {
							type: "sandbox",
							piece: "wr",
							from: "b2",
							stars: ["b7", "g7", "g3", "d3"],
							own: ["b5", "e7"],
							par: 6,
						},
					},
				],
			},
			{
				id: "bishop",
				title: "The bishop",
				steps: [
					{
						fen: "8/8/8/8/3B4/8/8/8 w - - 0 1",
						arrows: ["d4h8", "d4a7", "d4g1", "d4a1"],
						say: "The **bishop** moves diagonally, any distance. A bishop that starts on a light square stays on light squares for the whole game, and a dark-squared one on dark squares.",
					},
					{
						say: "Capture every star with the bishop.",
						task: {
							type: "sandbox",
							piece: "wb",
							from: "c1",
							stars: ["h6", "f8", "a3"],
							par: 4,
						},
					},
					{
						say: "Can you reach every star here? Remember which colour your bishop lives on.",
						task: {
							type: "sandbox",
							piece: "wb",
							from: "f1",
							stars: ["b5", "e8", "h3", "c2"],
							par: 5,
						},
					},
				],
			},
			{
				id: "queen",
				title: "The queen",
				steps: [
					{
						fen: "8/8/8/8/3Q4/8/8/8 w - - 0 1",
						arrows: [
							"d4d8",
							"d4h8",
							"d4h4",
							"d4g1",
							"d4d1",
							"d4a1",
							"d4a4",
							"d4a7",
						],
						say: "The **queen** is the strongest piece: she moves like a rook and a bishop together, in any straight line or diagonal, any distance.",
					},
					{
						say: "Capture every star with the queen, in as few moves as you can.",
						task: {
							type: "sandbox",
							piece: "wq",
							from: "d1",
							stars: ["d6", "g3", "b6", "h6", "a2"],
							par: 5,
						},
					},
				],
			},
			{
				id: "king",
				title: "The king",
				steps: [
					{
						fen: "8/8/8/8/3K4/8/8/8 w - - 0 1",
						arrows: [
							"d4d5",
							"d4e5",
							"d4e4",
							"d4e3",
							"d4d3",
							"d4c3",
							"d4c4",
							"d4c5",
						],
						say: "The **king** moves one square in any direction. He is the most important piece: the whole game is about trapping the other king.",
					},
					{
						say: "Walk the king to every star.",
						task: {
							type: "sandbox",
							piece: "wk",
							from: "e1",
							stars: ["e3", "g4", "f6", "d5"],
							par: 6,
						},
					},
				],
			},
			{
				id: "knight",
				title: "The knight",
				steps: [
					{
						fen: "8/8/8/8/3N4/8/8/8 w - - 0 1",
						arrows: [
							"d4e6",
							"d4f5",
							"d4f3",
							"d4e2",
							"d4c2",
							"d4b3",
							"d4b5",
							"d4c6",
						],
						say: "The **knight** moves in an L: two squares one way, then one square to the side. It is the only piece that **jumps** over others. A knight always lands on a square of the other colour.",
					},
					{
						say: "Capture every star with the knight.",
						task: {
							type: "sandbox",
							piece: "wn",
							from: "b1",
							stars: ["c3", "d5", "f6", "g4"],
							par: 4,
						},
					},
					{
						say: "A trickier route. Your own pawns are in the way, but a knight jumps.",
						task: {
							type: "sandbox",
							piece: "wn",
							from: "g1",
							stars: ["e2", "d4", "b5", "c7"],
							own: ["f2", "g2", "h2", "e3"],
							par: 6,
						},
					},
				],
			},
			{
				id: "pawn",
				title: "The pawn",
				steps: [
					{
						fen: "8/8/8/8/8/8/4P3/8 w - - 0 1",
						arrows: ["e2e3", "e2e4"],
						say: "The **pawn** moves straight forward, one square. On its very first move it may go two squares. It never moves backwards.",
					},
					{
						fen: "8/8/8/3p1p2/4P3/8/8/8 w - - 0 1",
						arrows: ["e4d5", "e4f5"],
						say: "But a pawn **captures diagonally**, one square forward. A piece right in front of it blocks it completely.",
					},
					{
						say: "Capture the stars with the pawn. It takes diagonally, and walks straight.",
						task: {
							type: "sandbox",
							piece: "wp",
							from: "c2",
							stars: ["d3", "c5", "b6", "a7"],
							par: 5,
						},
					},
				],
			},
			{
				id: "capture",
				title: "Capturing",
				steps: [
					{
						fen: "4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1",
						say: "Every piece captures the way it moves: it moves onto the enemy piece's square and takes it off the board. The black knight on d5 has no defender. Take it with the rook.",
						task: {
							type: "move",
							moves: ["Rxd5"],
							success: "The knight is yours.",
						},
					},
					{
						fen: "4k3/8/2p5/3p4/8/2N5/8/4K3 w - - 0 1",
						say: "Not every capture is a good idea. The knight could take the pawn on d5, but the pawn on c6 would take it back. Look before you take! Here, find a safe move for the knight that does **not** lose it.",
						task: {
							type: "move",
							moves: ["Na4", "Ne2", "Nd1", "Nb1", "Na2"],
							success:
								"Safe. Taking on d5 would have lost the knight for a pawn, and b5 and e4 are guarded by pawns too.",
						},
					},
				],
			},
			{
				id: "check",
				title: "Check",
				steps: [
					{
						fen: "4k3/8/8/8/8/8/8/3QK3 w - - 0 1",
						say: "When a piece attacks the king, the king is **in check**. Give check with the queen. Any check will do.",
						task: {
							type: "check",
							success: "Check! The black king is attacked.",
						},
					},
					{
						fen: "4k3/4r3/8/8/8/8/3B4/4K3 w - - 0 1",
						say: "A king in check must get out of it at once. There are three ways: **move** the king, **block** the check, or **capture** the attacker. Here the rook checks along the e-file. Block it with your bishop.",
						arrows: ["e7e1"],
						task: {
							type: "move",
							moves: ["Be3"],
							success:
								"Blocked. Moving the king to d1, f1 or f2 was also fine.",
						},
					},
					{
						fen: "4k3/8/8/8/8/8/4q3/4K3 w - - 0 1",
						say: "Sometimes the best way out is to capture the piece that gives check. Can the king take the queen? Only if nothing defends her.",
						task: {
							type: "move",
							moves: ["Kxe2"],
							success: "The king took the queen: nothing was guarding her.",
						},
					},
					{
						fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
						say: "One rule never changes: **you may never make a move that leaves your own king in check**. A move like that is simply not allowed, so the board will not let you.",
						task: {
							type: "quiz",
							q: "Your king is in check. Which of these is NOT a way out?",
							options: [
								"Move the king",
								"Block the check",
								"Capture the attacking piece",
								"Move another piece and ignore it",
							],
							answer: 3,
							explain:
								"You must deal with the check. Ignoring it is never allowed.",
						},
					},
				],
			},
			{
				id: "checkmate",
				title: "Checkmate",
				steps: [
					{
						fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1",
						say: "When a king is in check and **no move gets him out**, it is **checkmate**, and the game is over. Here the black king is attacked by the rook, his own pawns block every square, and nothing can capture or block. White has won.",
					},
					{
						fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
						say: "Your turn: checkmate in one move.",
						task: {
							type: "mate",
							success: "Checkmate! This is called a back-rank mate.",
						},
					},
					{
						fen: "k7/8/1K6/8/8/8/7Q/8 w - - 0 1",
						say: "Checkmate again, in one move. Your king helps by guarding squares next to the black king.",
						task: {
							type: "mate",
							success:
								"Checkmate. The queen attacks, your king guards a7 and b7.",
						},
					},
					{
						fen: "7k/8/6K1/8/8/8/8/5R2 w - - 0 1",
						say: "And one more.",
						task: { type: "mate", success: "Mate on the edge of the board." },
					},
				],
			},
			{
				id: "draws",
				title: "Stalemate and draws",
				steps: [
					{
						fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
						say: "Careful! Black to move, the king is **not** in check, but he has no legal move. That is **stalemate**, and stalemate is a **draw**, not a win. Many winning positions are thrown away like this.",
						marks: { h8: "bad" },
					},
					{
						fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
						say: "White to move. Qf7 here would be stalemate. Find the checkmate instead.",
						task: { type: "mate", success: "Checkmate, not stalemate." },
					},
					{
						say: "A game is also drawn when the same position appears **three times**, when **fifty moves** pass on each side without a capture or a pawn move, when **neither side has enough pieces** to checkmate (a lone king against a king and one bishop, for example), or simply when both players **agree**.",
						fen: "8/8/4k3/8/8/3BK3/8/8 w - - 0 1",
						task: {
							type: "quiz",
							q: "King and bishop against a lone king. Can anyone win?",
							options: ["Yes, the side with the bishop", "No, it is a draw"],
							answer: 1,
							explain:
								"A king and one bishop cannot force checkmate, so the game is drawn.",
						},
					},
				],
			},
			{
				id: "castling",
				title: "Castling",
				steps: [
					{
						fen: "r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1",
						arrows: ["e1g1", "h1f1"],
						say: "**Castling** is the one move where two pieces move at once: the king steps two squares towards a rook, and the rook jumps over to the king's other side. It tucks the king away safely and brings the rook into play. Castle on the king's side (short castling).",
						task: {
							type: "move",
							moves: ["O-O"],
							success: "Castled. The king is safe behind his pawns.",
						},
					},
					{
						fen: "r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1",
						arrows: ["e1c1", "a1d1"],
						say: "Now castle on the queen's side (long castling): the king goes to c1 and the rook to d1.",
						task: {
							type: "move",
							moves: ["O-O-O"],
							success: "Long castling done.",
						},
					},
					{
						fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
						say: "You may castle only if: neither the king nor that rook has moved yet, no pieces stand between them, the king is **not in check**, and the king does not pass through or land on a square that is attacked.",
						task: {
							type: "quiz",
							q: "Your king is in check. May you castle out of it?",
							options: ["Yes", "No"],
							answer: 1,
							explain: "Castling is never allowed while in check.",
						},
					},
				],
			},
			{
				id: "en-passant",
				title: "En passant",
				steps: [
					{
						fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
						arrows: ["d7d5"],
						say: 'A strange but real rule. Black\'s pawn has just jumped two squares, from d7 to d5, landing right beside your pawn on e5. Just this once, your pawn may capture it **as if it had moved only one square**: it moves to d6 and the black pawn disappears. That is **en passant** (French for "in passing"). Take it.',
						task: {
							type: "move",
							moves: ["exd6"],
							success:
								"En passant! The capture must be made right away, or the chance is gone.",
						},
					},
				],
			},
			{
				id: "promotion",
				title: "Promotion",
				steps: [
					{
						fen: "8/4P1k1/8/8/8/8/8/4K3 w - - 0 1",
						say: "When a pawn reaches the far end of the board it is **promoted**: it turns into a queen, rook, bishop or knight, whichever you like. Almost always a queen. Promote your pawn.",
						task: { type: "move", moves: ["e8=Q"], success: "A new queen!" },
					},
					{
						fen: "8/8/8/8/8/8/k1p5/2K5 b - - 0 1",
						say: "Black's pawn on c2 is one step from promoting, but the white king stands right in front of it.",
						task: {
							type: "quiz",
							q: "Can the black pawn promote by moving to c1?",
							options: ["Yes", "No, the white king is standing on c1"],
							answer: 1,
							explain:
								"A pawn moves straight ahead and cannot capture straight ahead, so a piece on c1 blocks it.",
						},
					},
				],
			},
			{
				id: "values",
				title: "What pieces are worth",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "To decide whether a trade is good, players count pieces in points: **pawn 1, knight 3, bishop 3, rook 5, queen 9**. The king is priceless. Giving a knight for a rook wins you two points; giving a queen for a rook loses four.",
					},
					{
						fen: "4k3/8/2q1n3/8/3N4/8/8/4K3 w - - 0 1",
						say: "Your knight can take either piece. Which capture wins more?",
						task: {
							type: "move",
							moves: ["Nxc6"],
							success: "The queen: nine points.",
						},
					},
					{
						say: "A rook for a bishop.",
						fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
						task: {
							type: "quiz",
							q: "You give your bishop and get a rook. Is that good for you?",
							options: [
								"Yes, I win about two points",
								"No, I lose material",
								"It is even",
							],
							answer: 0,
							explain:
								"A rook (5) is worth about two points more than a bishop (3). This is called winning the exchange.",
						},
					},
				],
			},
			{
				id: "first-game",
				title: "Your first game",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "You know all the rules now. A few tips for your first games: put pawns and pieces in the **centre**, bring out your **knights and bishops** before the queen, **castle** early, and before every move ask: *what is my opponent threatening?*",
						task: {
							type: "go-play",
							level: "beginner",
							label: "Play a game at Beginner level",
						},
					},
				],
			},
		],
	},
	{
		id: "tactics",
		title: "Tactics",
		level: "Beginner to intermediate",
		about:
			"The short combinations that win games: loose pieces, forks, pins, skewers, discovered attacks and more, each with puzzles from real games.",
		lessons: [
			{
				id: "loose",
				title: "Loose pieces",
				steps: [
					{
						fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
						say: "Most games between beginners are decided by a piece left **undefended**. Before every move, check: is anything of mine loose? Is anything of theirs? Black's knight has just grabbed the pawn on e4, and nothing defends it there. Find a good move for White.",
						task: {
							type: "best",
							tolerance: 60,
							success:
								"Good. A loose piece is a target: hit it, or use the time it costs to save it.",
						},
					},
					{
						say: "Now find the loose piece in positions from real games.",
						task: {
							type: "puzzles",
							theme: "hangingPiece",
							count: 4,
							max: 1200,
						},
					},
				],
			},
			{
				id: "fork",
				title: "The fork",
				steps: [
					{
						fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
						say: "A **fork** is one piece attacking two at once. The opponent can save only one. Knights are the great forkers. Find the knight move that attacks the king and the rook together.",
						task: {
							type: "move",
							moves: ["Nc7+"],
							success: "A royal fork: check, and next move the rook is yours.",
						},
					},
					{
						say: "Forks from real games.",
						task: { type: "puzzles", theme: "fork", count: 5, max: 1400 },
					},
				],
			},
			{
				id: "pin",
				title: "The pin",
				steps: [
					{
						fen: "4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1",
						say: "A **pin** freezes a piece: it cannot move without exposing something more valuable behind it. Pin the black knight to its king with your bishop.",
						task: {
							type: "move",
							moves: ["Bb5"],
							success:
								"Pinned. The knight cannot move at all: that would expose the king.",
						},
					},
					{
						say: "Pins from real games.",
						task: { type: "puzzles", theme: "pin", count: 4, max: 1500 },
					},
				],
			},
			{
				id: "skewer",
				title: "The skewer",
				steps: [
					{
						fen: "5q2/8/8/2k5/8/8/8/2B1K3 w - - 0 1",
						say: "A **skewer** is a pin turned around: attack a valuable piece, it steps aside, and you take what stood behind it. Give check with the bishop so that the queen behind the king falls.",
						task: {
							type: "move",
							moves: ["Ba3+"],
							success: "The king must move, and the queen on f8 is lost.",
						},
					},
					{
						say: "Skewers from real games.",
						task: { type: "puzzles", theme: "skewer", count: 4, max: 1500 },
					},
				],
			},
			{
				id: "discovered",
				title: "Discovered attack",
				steps: [
					{
						fen: "q3k3/8/8/8/4B3/8/8/4RK2 w - - 0 1",
						say: "Move one piece out of the way and another one behind it attacks: a **discovered attack**. When the hidden piece gives check, the piece that moved can grab anything. Find it.",
						task: {
							type: "move",
							moves: ["Bxa8+"],
							success:
								"Discovered check: the rook checks, the bishop takes the queen.",
						},
					},
					{
						say: "Discovered attacks from real games.",
						task: {
							type: "puzzles",
							theme: "discoveredAttack",
							count: 4,
							max: 1600,
						},
					},
				],
			},
			{
				id: "defender",
				title: "Removing the defender",
				steps: [
					{
						say: "If one piece is guarding another, capture or chase away the **guard**, and what it guarded falls. Two related tricks: **deflection** (lure the defender away) and **attraction** (draw a piece onto a bad square).",
						fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1",
					},
					{
						say: "Take out the defender.",
						task: {
							type: "puzzles",
							theme: "capturingDefender",
							count: 3,
							max: 1700,
						},
					},
					{
						say: "Deflect it.",
						task: { type: "puzzles", theme: "deflection", count: 3, max: 1700 },
					},
				],
			},
			{
				id: "backrank",
				title: "The back rank",
				steps: [
					{
						fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
						say: "A castled king behind three unmoved pawns has no air. A rook or queen on the last rank can mate him. Do it.",
						task: {
							type: "mate",
							success:
								"Back-rank mate. Tip: in your own games, a pawn move like h3 gives your king an escape square.",
						},
					},
					{
						say: "Back-rank mates from real games.",
						task: {
							type: "puzzles",
							theme: "backRankMate",
							count: 4,
							max: 1500,
						},
					},
				],
			},
			{
				id: "sacrifice",
				title: "Sacrifices",
				steps: [
					{
						say: "Sometimes giving away material is the strongest move: it opens the king, deflects a defender or clears the way for a mate. A sacrifice is only good if you can calculate what you get back.",
						fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
					},
					{
						say: "Sacrifices from real games. Calculate before you give!",
						task: { type: "puzzles", theme: "sacrifice", count: 4, max: 1800 },
					},
				],
			},
		],
	},
	{
		id: "mates",
		title: "Checkmate patterns",
		level: "Beginner to intermediate",
		about:
			"How to mate with queen or rook against a lone king, and the classic mating pictures every player should recognise.",
		lessons: [
			{
				id: "queen-mate",
				title: "Mate with the queen",
				steps: [
					{
						fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1",
						say: "King and queen against a lone king is always a win, if you know how. **Squeeze**: use the queen to shrink the king's box, a knight's move away from him, without giving check. When he is on the edge, bring your own king up and mate. Beware stalemate!",
					},
					{
						fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1",
						say: "Checkmate the black king. The engine defends.",
						task: { type: "play", goal: "mate", level: "expert", maxMoves: 30 },
					},
				],
			},
			{
				id: "rook-mate",
				title: "Mate with the rook",
				steps: [
					{
						fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
						say: "King and rook also win, but it takes teamwork. The rook cuts the king off along a rank or file; your king walks up to **face** the enemy king (with one square between); then the rook checks, and the king must step back towards the edge. Repeat until he is on the edge, then mate.",
					},
					{
						fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
						say: "Checkmate the black king with king and rook.",
						task: { type: "play", goal: "mate", level: "expert", maxMoves: 40 },
					},
				],
			},
			{
				id: "two-rooks",
				title: "The ladder",
				steps: [
					{
						fen: "8/8/8/4k3/8/8/8/R3K2R w - - 0 1",
						say: "Two rooks (or queen and rook) mate without help from the king: they take turns checking and guarding, walking the king to the edge like climbing a ladder. Try it.",
						task: { type: "play", goal: "mate", level: "expert", maxMoves: 16 },
					},
				],
			},
			{
				id: "smothered",
				title: "Smothered mate",
				steps: [
					{
						fen: "6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1",
						say: "A king surrounded by his **own** pieces can be mated by a single knight: a **smothered mate**. The black king cannot move, and the knight's check cannot be blocked.",
					},
					{
						say: "Find the smothered mates.",
						task: {
							type: "puzzles",
							theme: "smotheredMate",
							count: 3,
							max: 2000,
						},
					},
				],
			},
			{
				id: "classic-mates",
				title: "Classic mating pictures",
				steps: [
					{
						fen: "7k/7R/5N2/8/8/8/8/6K1 b - - 0 1",
						say: "**Arabian mate**: rook and knight in the corner. The knight guards the rook and covers the last escape square.",
					},
					{
						fen: "5r2/4Nppk/8/8/8/8/8/6KR b - - 0 1",
						say: "**Anastasia's mate**: a knight takes away the king's squares, a rook checks along the edge.",
					},
					{
						fen: "2kr4/3p4/B7/8/5B2/8/8/6K1 b - - 0 1",
						say: "**Boden's mate**: two bishops on crossing diagonals, against a king boxed in by his own pieces.",
					},
					{
						say: "Arabian mates.",
						task: {
							type: "puzzles",
							theme: "arabianMate",
							count: 2,
							max: 2200,
						},
					},
					{
						say: "Anastasia's mates.",
						task: {
							type: "puzzles",
							theme: "anastasiaMate",
							count: 2,
							max: 2200,
						},
					},
					{
						say: "Mate in two, any pattern.",
						task: { type: "puzzles", theme: "mateIn2", count: 4, max: 1600 },
					},
				],
			},
		],
	},
	{
		id: "openings",
		title: "Openings",
		level: "Beginner to advanced",
		about:
			"The principles of a good start, then the main openings move by move, with the idea behind each move.",
		lessons: [
			{
				id: "principles",
				title: "How to start a game",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						marks: { d4: "target", e4: "target", d5: "target", e5: "target" },
						say: "Three ideas carry most openings. **1. Take the centre.** The four middle squares are the best roads for your pieces; pawns on e4 and d4 claim them.",
					},
					{
						fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
						arrows: ["f1c4", "b1c3", "c1e3"],
						say: "**2. Develop your pieces.** Bring knights and bishops out quickly, towards the centre. Do not move the same piece twice without a reason, and keep the queen at home for now: chased around, she wastes your time.",
					},
					{
						fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5",
						arrows: ["e1g1"],
						say: "**3. Castle early.** It hides your king and connects your rooks. Castle now.",
						task: {
							type: "move",
							moves: ["O-O"],
							success: "Safe king, rooks ready. That is a good opening.",
						},
					},
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "Which of these is the best first move?",
						task: {
							type: "quiz",
							q: "Which of these is the best first move?",
							options: ["a4", "h4", "e4", "Na3"],
							answer: 2,
							explain:
								"e4 takes the centre and opens lines for the queen and the bishop.",
						},
					},
				],
			},
			{
				id: "scholars",
				title: "The four-move trap",
				steps: [
					{
						fen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
						say: "This is **Scholar's Mate**: the white queen and bishop both hit f7, the weakest point near Black's king, and the queen takes there with checkmate. It catches many beginners. Let's learn to stop it.",
					},
					{
						fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
						say: "White threatens Qxf7 mate. Find a move that stops it and develops a piece.",
						task: {
							type: "move",
							moves: ["g6", "Qe7", "Qf6", "Nh6"],
							success:
								"Stopped. After g6, the queen is attacked and must retreat, and you keep playing.",
						},
					},
				],
			},
			{
				id: "italian",
				title: "Italian Game",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "The **Italian Game**, one of the oldest openings and still played by world champions. Play White's moves; the board answers for Black.",
						task: {
							type: "line",
							you: "w",
							moves: [
								"e4",
								"e5",
								"Nf3",
								"Nc6",
								"Bc4",
								"Bc5",
								"c3",
								"Nf6",
								"d3",
								"d6",
								"O-O",
								"O-O",
							],
							notes: {
								1: "e4: the centre, and lines for the queen and bishop.",
								3: "Nf3 develops and attacks the pawn on e5.",
								4: "Black defends with Nc6.",
								5: "Bc4 aims at f7, Black's sore point.",
								7: "c3 prepares d4, a big pawn centre.",
								9: "d3: the calm, modern way. Solid, flexible.",
								11: "Castle. Both sides are ready for the middlegame.",
							},
						},
					},
				],
			},
			{
				id: "ruy",
				title: "Ruy Lopez",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "The **Ruy Lopez** (or Spanish): White's bishop pressures the knight that defends e5. Play White.",
						task: {
							type: "line",
							you: "w",
							moves: [
								"e4",
								"e5",
								"Nf3",
								"Nc6",
								"Bb5",
								"a6",
								"Ba4",
								"Nf6",
								"O-O",
								"Be7",
								"Re1",
								"b5",
								"Bb3",
								"d6",
								"c3",
								"O-O",
							],
							notes: {
								5: "Bb5 attacks the defender of e5.",
								6: "a6 asks the bishop what it wants.",
								7: "Ba4 keeps the pressure.",
								9: "Castle first; e4 is safe for now.",
								11: "Re1 guards e4 and prepares the centre.",
								15: "c3 prepares d4. A rich middlegame lies ahead.",
							},
						},
					},
				],
			},
			{
				id: "sicilian",
				title: "Sicilian Defence",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "Against 1.e4, the **Sicilian** is Black's fighting answer: instead of copying, Black hits d4 from the side. You play Black.",
						you: "b",
						task: {
							type: "line",
							you: "b",
							moves: [
								"e4",
								"c5",
								"Nf3",
								"d6",
								"d4",
								"cxd4",
								"Nxd4",
								"Nf6",
								"Nc3",
								"a6",
							],
							notes: {
								2: "c5 controls d4 without allowing a mirror image.",
								6: "Take back towards the centre: Black trades a side pawn for White's centre pawn.",
								8: "Nf6 attacks e4 and develops.",
								10: "a6: the Najdorf, Fischer's and Kasparov's favourite. It keeps pieces off b5 and prepares e5 or b5.",
							},
						},
					},
				],
			},
			{
				id: "french",
				title: "French Defence",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "The **French**: Black lets White have space and strikes back at the pawn chain. You play Black.",
						you: "b",
						task: {
							type: "line",
							you: "b",
							moves: [
								"e4",
								"e6",
								"d4",
								"d5",
								"e5",
								"c5",
								"c3",
								"Nc6",
								"Nf3",
								"Qb6",
							],
							notes: {
								2: "e6 prepares d5.",
								4: "d5 challenges e4 straight away.",
								6: "When White pushes e5, hit the base of the chain with c5.",
								8: "More pressure on d4.",
								10: "Qb6: d4 is attacked three times.",
							},
						},
					},
				],
			},
			{
				id: "caro",
				title: "Caro-Kann Defence",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "The **Caro-Kann**: solid and sound. Black prepares d5 with c6 and develops the light-squared bishop before closing it in. You play Black.",
						you: "b",
						task: {
							type: "line",
							you: "b",
							moves: [
								"e4",
								"c6",
								"d4",
								"d5",
								"Nc3",
								"dxe4",
								"Nxe4",
								"Bf5",
								"Ng3",
								"Bg6",
							],
							notes: {
								2: "c6 supports d5.",
								4: "d5: the centre fight begins.",
								8: "Bf5: the bishop comes out before e6.",
								10: "Bg6 keeps it safe. Black has a healthy position.",
							},
						},
					},
				],
			},
			{
				id: "qgd",
				title: "Queen's Gambit",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "The **Queen's Gambit**: White offers a side pawn to win the centre. Play White.",
						task: {
							type: "line",
							you: "w",
							moves: [
								"d4",
								"d5",
								"c4",
								"e6",
								"Nc3",
								"Nf6",
								"Bg5",
								"Be7",
								"e3",
								"O-O",
								"Nf3",
							],
							notes: {
								3: "c4: the 'gambit'. If Black takes, White regains the pawn easily and gets the centre.",
								4: "e6: Black declines and holds d5.",
								7: "Bg5 pins the knight that defends d5.",
								9: "e3 opens the way for the other bishop.",
								11: "Classical development; a slow, strategic game follows.",
							},
						},
					},
				],
			},
			{
				id: "london",
				title: "London System",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "The **London System**: the same easy setup against almost anything. Play White.",
						task: {
							type: "line",
							you: "w",
							moves: [
								"d4",
								"d5",
								"Bf4",
								"Nf6",
								"e3",
								"e6",
								"Nf3",
								"c5",
								"c3",
								"Nc6",
								"Nbd2",
								"Bd6",
								"Bg3",
							],
							notes: {
								3: "Bf4 comes out before e3 locks it in.",
								5: "e3 builds the pyramid of pawns.",
								9: "c3 holds d4 rock solid.",
								11: "Nbd2 supports e4 later.",
								13: "Bg3 keeps the bishop; trading on g3 would open the h-file for White's rook.",
							},
						},
					},
				],
			},
			{
				id: "kid",
				title: "King's Indian Defence",
				steps: [
					{
						fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
						say: "The **King's Indian**: Black lets White build a big centre, then attacks it. You play Black.",
						you: "b",
						task: {
							type: "line",
							you: "b",
							moves: [
								"d4",
								"Nf6",
								"c4",
								"g6",
								"Nc3",
								"Bg7",
								"e4",
								"d6",
								"Nf3",
								"O-O",
								"Be2",
								"e5",
							],
							notes: {
								2: "Nf6 keeps options open.",
								4: "g6 prepares a fianchetto: the bishop on the long diagonal.",
								8: "d6, and the king goes to safety.",
								12: "e5 strikes at the centre. Sharp play on opposite wings follows.",
							},
						},
					},
				],
			},
			{
				id: "opening-traps",
				title: "Opening traps",
				steps: [
					{
						say: "Short tactics from the first moves of real games.",
						task: { type: "puzzles", theme: "opening", count: 5, max: 1700 },
					},
				],
			},
		],
	},
	{
		id: "endgames",
		title: "Endgames",
		level: "Intermediate to advanced",
		about:
			"Few pieces, precise technique: the square, opposition, key squares, Lucena and Philidor, and rook endgames.",
		lessons: [
			{
				id: "square",
				title: "The rule of the square",
				steps: [
					{
						fen: "7k/8/8/8/p7/8/4K3/8 w - - 0 1",
						marks: { a4: "target", d4: "target", a1: "target", d1: "target" },
						say: "Can a king catch a runaway pawn? Picture a **square** from the pawn to its promotion square (here a4, d4, d1, a1). If the king can step into that square, he catches the pawn. Here he can: step in, then chase it down.",
					},
					{
						fen: "7k/8/8/8/p7/8/4K3/8 w - - 0 1",
						say: "Stop the pawn: capture it before it promotes.",
						task: {
							type: "play",
							goal: "capture-pawns",
							level: "expert",
							maxMoves: 10,
						},
					},
				],
			},
			{
				id: "opposition",
				title: "Opposition and key squares",
				steps: [
					{
						fen: "4k3/8/4K3/4P3/8/8/8/8 b - - 0 1",
						say: "Kings standing face to face with one square between them are in **opposition**: whoever has to move must give way. With king and pawn against king, the attacking king wants to reach the **key squares** two ranks in front of his pawn; then the pawn promotes by force.",
					},
					{
						fen: "4k3/8/8/8/8/4K3/4P3/8 w - - 0 1",
						say: "Win this: promote the pawn. Lead with the king, not the pawn.",
						task: {
							type: "play",
							goal: "promote",
							level: "expert",
							maxMoves: 25,
						},
					},
				],
			},
			{
				id: "lucena",
				title: "The Lucena position",
				steps: [
					{
						fen: "1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1",
						say: "The most important winning rook endgame. White's king is stuck in front of his pawn and Black's rook checks from the side. The winning method is called **building a bridge**: check the king away with the rook, then put your rook on the fourth rank to block the checks later.",
					},
					{
						fen: "1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1",
						say: "Win it: promote the pawn. Start with a check on the d-file.",
						task: {
							type: "play",
							goal: "promote",
							level: "expert",
							maxMoves: 30,
						},
					},
				],
			},
			{
				id: "philidor",
				title: "The Philidor defence",
				steps: [
					{
						fen: "4k3/8/r7/4PK2/8/8/8/7R b - - 0 1",
						say: "The most important drawing method. With the defending king in front of the pawn, keep your rook on the **sixth rank** (third from your king's side) so the enemy king cannot come forward. Only when the pawn steps to the sixth, go behind and check from far away.",
						you: "b",
					},
					{
						fen: "4k3/8/r7/4PK2/8/8/8/7R b - - 0 1",
						say: "Hold the draw for twenty moves, as Black.",
						you: "b",
						task: { type: "play", goal: "hold", level: "expert", maxMoves: 20 },
					},
				],
			},
			{
				id: "endgame-practice",
				title: "Endgame practice",
				steps: [
					{
						say: "Pawn endgames from real games.",
						task: {
							type: "puzzles",
							theme: "pawnEndgame",
							count: 3,
							max: 1800,
						},
					},
					{
						say: "Rook endgames from real games.",
						task: {
							type: "puzzles",
							theme: "rookEndgame",
							count: 3,
							max: 1900,
						},
					},
				],
			},
		],
	},
	{
		id: "strategy",
		title: "Strategy",
		level: "Advanced",
		about:
			"How strong players think when there is no tactic: pawn structure, outposts, good and bad bishops, open files, weak squares, prophylaxis and making a plan.",
		lessons: [
			{
				id: "pawn-structure",
				title: "Pawn structure",
				steps: [
					{
						fen: "4k3/pp3ppp/8/3p4/8/8/PP3PPP/4K3 w - - 0 1",
						marks: { d5: "bad" },
						say: "Pawns cannot move back, so their placement shapes the whole game. An **isolated pawn** (like d5 here, with no friendly pawns on the files beside it) cannot be defended by another pawn, and the square in front of it is a perfect home for an enemy piece.",
					},
					{
						fen: "4k3/pp3p1p/5p2/8/8/8/PP3PPP/4K3 w - - 0 1",
						marks: { f6: "bad", f7: "bad" },
						say: "**Doubled pawns** (f7 and f6) are slow and cannot protect each other. A **passed pawn** has no enemy pawns in front of it or on the files beside it, and it must be watched every move.",
					},
					{
						fen: "4k3/8/8/3P4/8/8/8/4K3 w - - 0 1",
						task: {
							type: "quiz",
							q: "Which of these is a passed pawn?",
							options: [
								"A pawn with no enemy pawns ahead of it on its file or the two beside it",
								"A pawn that has moved two squares",
								"Any pawn past the middle of the board",
							],
							answer: 0,
							explain:
								"Nothing can stop it but pieces, so it often decides endgames.",
						},
					},
				],
			},
			{
				id: "outposts",
				title: "Outposts",
				steps: [
					{
						fen: "r4rk1/pp3ppp/3p4/2pNp3/2P1P3/8/PP3PPP/R4RK1 w - - 0 1",
						marks: { d5: "good" },
						say: "An **outpost** is a square in or near the enemy camp that no enemy pawn can ever attack. A knight on d5 here is a monster: it can only be removed by giving up a piece for it.",
					},
					{
						fen: "r1bq1rk1/pp2bppp/2np1n2/4p3/4P3/1NN1B3/PPP1BPPP/R2Q1RK1 w - - 0 10",
						say: "Find a good move for White. Think about the d5 square.",
						task: {
							type: "best",
							tolerance: 50,
							success:
								"Good. Squares like d5, which Black's pawns can no longer attack, are worth fighting for.",
						},
					},
				],
			},
			{
				id: "bishops",
				title: "Good and bad bishops",
				steps: [
					{
						fen: "4k3/8/4p3/1p1pPp2/1P1P1P2/4B3/8/4K3 w - - 0 1",
						say: "A bishop is **bad** when its own pawns stand on its colour, blocking it. White's bishop on e3 is hemmed in by its own pawns on b4, d4, e5 and f4, all on dark squares. Put your pawns on the opposite colour to your bishop.",
					},
					{
						task: {
							type: "quiz",
							q: "Your pawns are fixed on dark squares. Which bishop would you rather keep?",
							options: ["The light-squared bishop", "The dark-squared bishop"],
							answer: 0,
							explain:
								"The light-squared bishop is not blocked by pawns on dark squares, so it has more scope.",
						},
						fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
					},
				],
			},
			{
				id: "files",
				title: "Open files and the seventh rank",
				steps: [
					{
						fen: "3r2k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1",
						say: "Rooks need **open files** (no pawns on them) to get into the game. Whoever controls the open file can invade, often on the **seventh rank**, where the enemy pawns sit undefended.",
					},
					{
						fen: "2r3k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1",
						say: "Find a good move for White.",
						task: {
							type: "best",
							tolerance: 40,
							success:
								"The open d-file and the seventh rank: that's where rooks belong.",
						},
					},
				],
			},
			{
				id: "prophylaxis",
				title: "Prophylaxis",
				steps: [
					{
						say: "**Prophylaxis** means asking, before your own plan: *what does my opponent want to do?* and stopping it first. Many strong moves are quiet: a pawn move that takes away a square, a rook that defends in advance.",
						fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 0 7",
					},
					{
						fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 0 7",
						say: "Black would like to play Bg4, pinning your knight. Find a good move, quiet ones welcome.",
						task: { type: "best", tolerance: 40, success: "Well judged." },
					},
					{
						say: "Quiet moves from real games.",
						task: { type: "puzzles", theme: "quietMove", count: 3, max: 2000 },
					},
				],
			},
			{
				id: "planning",
				title: "Making a plan",
				steps: [
					{
						say: "When there is no tactic, make a plan: **1.** find your worst piece and improve it; **2.** find the opponent's weaknesses (a weak pawn, a weak square, an exposed king); **3.** bring more pieces there than he can defend with. Then calculate.",
						fen: "r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R2Q1RK1 w - - 0 10",
					},
					{
						fen: "r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R2Q1RK1 w - - 0 10",
						say: "Find a good move for White, with a plan in mind.",
						task: {
							type: "best",
							tolerance: 40,
							success:
								"A move with a purpose. Ask your Bot what plan it serves, if you like.",
						},
					},
					{
						say: "Advanced positions from real games.",
						task: { type: "puzzles", theme: "advantage", count: 3, max: 2300 },
					},
				],
			},
		],
	},
];

export const lessonKey = (course, lesson) => `${course}/${lesson}`;

export function findLesson(courseId, lessonId) {
	const course = COURSES.find((c) => c.id === courseId);
	const lesson = course?.lessons.find((l) => l.id === lessonId);
	return course && lesson ? { course, lesson } : null;
}
