/*
 * THE 2D BOARD: a flat board for those who prefer it, for lessons, puzzles and the chat cards.
 * The same interface as the 3D board, so the page does not care which one it has:
 *
 *   const board = createBoard2d(el, { orientation: "w", onMove: ({ from, to }) => ... });
 *   board.set({ pieces, last, check, movable: { colour: "w", dests: Map("e2" => ["e3","e4"]) },
 *               move: { from, to, rook: [from, to], ep: square }, arrows: [{ from, to, kind }],
 *               marks: { e4: "good" } });
 *   board.orient("b"); board.destroy();
 *
 * `pieces` is { e1: "wk", e2: "wp", ... }. Moves animate when `move` says which one was made.
 */
import { pieceSvg } from "./pieces.js";

const FILES = "abcdefgh";

export function piecesFromGame(game) {
	const out = {};
	for (const row of game.board())
		for (const p of row) if (p) out[p.square] = p.colour + p.type;
	return out;
}

export function createBoard2d(
	host,
	{ orientation = "w", coords = true, onMove, onSelect } = {},
) {
	const el = document.createElement("div");
	el.className = "b2";
	el.innerHTML = `<div class="b2-sq"></div><svg class="b2-arrows" viewBox="0 0 8 8" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs><g></g></svg><div class="b2-pieces"></div>`;
	host.appendChild(el);
	const sqLayer = el.querySelector(".b2-sq");
	const pcLayer = el.querySelector(".b2-pieces");
	const arrows = el.querySelector(".b2-arrows g");
	let orient = orientation;
	let state = { pieces: {}, movable: null };
	let selected = null;
	const els = new Map(); // square -> { el, code }

	const xy = (sq) => {
		const f = FILES.indexOf(sq[0]);
		const r = Number(sq[1]) - 1;
		return orient === "w" ? [f, 7 - r] : [7 - f, r];
	};
	const sqAt = (x, y) =>
		orient === "w" ? FILES[x] + (8 - y) : FILES[7 - x] + (y + 1);

	function drawSquares() {
		let html = "";
		for (let y = 0; y < 8; y++)
			for (let x = 0; x < 8; x++) {
				const sq = sqAt(x, y);
				const light = (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 0;
				let label = "";
				if (coords && y === 7) label += `<i class="cf">${sq[0]}</i>`;
				if (coords && x === 0) label += `<i class="cr">${sq[1]}</i>`;
				html += `<div class="s ${light ? "l" : "d"}" data-sq="${sq}">${label}</div>`;
			}
		sqLayer.innerHTML = html;
	}

	const place = (node, sq) => {
		const [x, y] = xy(sq);
		node.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
	};

	function addPiece(sq, code) {
		const node = document.createElement("div");
		node.className = "p";
		node.innerHTML = pieceSvg(code[1], code[0]);
		node.dataset.code = code;
		place(node, sq);
		pcLayer.appendChild(node);
		els.set(sq, { el: node, code });
		return node;
	}

	function removePiece(sq, fade) {
		const cur = els.get(sq);
		if (!cur) return;
		els.delete(sq);
		if (fade) {
			cur.el.classList.add("gone");
			setTimeout(() => cur.el.remove(), 220);
		} else cur.el.remove();
	}

	function shift(from, to) {
		const cur = els.get(from);
		if (!cur) return;
		removePiece(to, true);
		els.delete(from);
		els.set(to, cur);
		cur.el.classList.add("moving");
		place(cur.el, to);
		setTimeout(() => cur.el.classList.remove("moving"), 260);
	}

	function marks() {
		const s = state;
		const dests = selected && s.movable?.dests?.get(selected);
		for (const node of sqLayer.children) {
			const sq = node.dataset.sq;
			node.classList.toggle("last", Boolean(s.last?.includes(sq)));
			node.classList.toggle("check", s.check === sq);
			node.classList.toggle("sel", selected === sq);
			const target = dests?.includes(sq);
			node.classList.toggle("dot", Boolean(target && !s.pieces[sq]));
			node.classList.toggle("ring", Boolean(target && s.pieces[sq]));
			node.dataset.mark = s.marks?.[sq] ?? "";
		}
		let svg = "";
		for (const a of s.arrows ?? []) {
			const [x1, y1] = xy(a.from);
			const [x2, y2] = xy(a.to);
			const dx = x2 - x1;
			const dy = y2 - y1;
			const len = Math.hypot(dx, dy) || 1;
			const ex = x2 + 0.5 - (dx / len) * 0.32;
			const ey = y2 + 0.5 - (dy / len) * 0.32;
			svg += `<line class="ar ${a.kind ?? ""}" x1="${x1 + 0.5}" y1="${y1 + 0.5}" x2="${ex}" y2="${ey}" marker-end="url(#ah)"/>`;
		}
		arrows.innerHTML = svg;
	}

	function set(next) {
		const prev = state.pieces;
		state = { ...state, ...next };
		if (next.pieces) {
			const mv = next.move;
			if (mv && prev[mv.from]) {
				shift(mv.from, mv.to);
				if (mv.rook) shift(mv.rook[0], mv.rook[1]);
				if (mv.ep) removePiece(mv.ep, true);
			}
			// whatever does not match now: replace it
			for (const [sq, cur] of [...els])
				if (next.pieces[sq] !== cur.code) removePiece(sq, false);
			for (const [sq, code] of Object.entries(next.pieces))
				if (!els.has(sq)) addPiece(sq, code);
			if (!("selected" in next)) selected = null;
		}
		if (next.movable === null) selected = null;
		marks();
	}

	function select(sq) {
		selected = sq;
		marks();
		onSelect?.(sq);
	}

	const canMove = (sq) => {
		const m = state.movable;
		return Boolean(
			m && state.pieces[sq]?.[0] === m.colour && m.dests?.get(sq)?.length,
		);
	};
	const isDest = (sq) =>
		Boolean(selected && state.movable?.dests?.get(selected)?.includes(sq));

	function squareFromPoint(cx, cy) {
		const r = el.getBoundingClientRect();
		const x = Math.floor(((cx - r.left) / r.width) * 8);
		const y = Math.floor(((cy - r.top) / r.height) * 8);
		if (x < 0 || x > 7 || y < 0 || y > 7) return null;
		return sqAt(x, y);
	}

	// click to move, or drag
	let drag = null;
	el.addEventListener("pointerdown", (e) => {
		if (e.button !== 0) return;
		const sq = squareFromPoint(e.clientX, e.clientY);
		if (!sq) return;
		if (selected && isDest(sq)) {
			const from = selected;
			selected = null;
			marks();
			onMove?.({ from, to: sq });
			return;
		}
		if (canMove(sq)) {
			e.preventDefault();
			const again = selected === sq;
			select(sq);
			const node = els.get(sq)?.el;
			if (node) {
				drag = { sq, node, again, x: e.clientX, y: e.clientY, moved: false };
				el.setPointerCapture(e.pointerId);
			}
			return;
		}
		selected = null;
		marks();
		onSelect?.(null);
	});
	el.addEventListener("pointermove", (e) => {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!drag.moved && Math.hypot(dx, dy) < 4) return;
		drag.moved = true;
		const r = el.getBoundingClientRect();
		const size = r.width / 8;
		const px = e.clientX - r.left - size / 2;
		const py = e.clientY - r.top - size / 2;
		drag.node.classList.add("drag");
		drag.node.style.transform = `translate(${px}px, ${py}px) scale(1.1)`;
		const over = squareFromPoint(e.clientX, e.clientY);
		for (const node of sqLayer.children)
			node.classList.toggle("over", node.dataset.sq === over && isDest(over));
	});
	const endDrag = (e) => {
		if (!drag) return;
		const d = drag;
		drag = null;
		for (const node of sqLayer.children) node.classList.remove("over");
		d.node.classList.remove("drag");
		if (!d.moved) {
			// a second click on the selected piece puts it down
			if (d.again) {
				selected = null;
				marks();
			}
			return;
		}
		const to = e ? squareFromPoint(e.clientX, e.clientY) : null;
		if (to && to !== d.sq && isDest(to)) {
			// land where it was dropped, without sliding back first
			d.node.style.transition = "none";
			place(d.node, to);
			requestAnimationFrame(() => {
				d.node.style.transition = "";
			});
			selected = null;
			marks();
			onMove?.({ from: d.sq, to, dropped: true });
		} else place(d.node, d.sq);
	};
	el.addEventListener("pointerup", endDrag);
	el.addEventListener("pointercancel", () => endDrag(null));

	drawSquares();

	return {
		el,
		kind: "2d",
		set,
		get orientation() {
			return orient;
		},
		orient(o) {
			if (o === orient) return;
			orient = o;
			drawSquares();
			for (const [sq, cur] of els) place(cur.el, sq);
			marks();
		},
		select(sq) {
			select(sq);
		},
		/** Where a square is on screen (for little pop-overs like the promotion choice). */
		rectOf(sq) {
			const [x, y] = xy(sq);
			const r = el.getBoundingClientRect();
			const s = r.width / 8;
			return { left: r.left + x * s, top: r.top + y * s, width: s, height: s };
		},
		resize() {},
		destroy() {
			el.remove();
		},
	};
}
