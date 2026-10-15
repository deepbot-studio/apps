/*
 * TALKING TO THE ENGINE from the page. The engine runs in a worker so the board stays smooth; an app
 * frame has an origin of its own, so the worker is started from a small blob that imports the real
 * file. Where a worker cannot start, the engine runs on the page between frames instead: slower to
 * feel, same moves.
 *
 *   const engine = createEngine();
 *   const r = await engine.move({ fen, moves, level: "medium", ms });   // { move: "e2e4", score, depth, pv }
 *   const a = await engine.analyse({ fen, moves, ms: 400 }, (info) => ...);
 *   engine.cancel();   // stop whatever it is doing (the promise rejects with { cancelled: true })
 */
export function createEngine() {
	let worker = null;
	let seq = 0;
	const pending = new Map();
	let local = null;

	function start() {
		try {
			const url = new URL("./engine-worker.js", import.meta.url).href;
			const blob = new Blob([`import ${JSON.stringify(url)};`], {
				type: "text/javascript",
			});
			const w = new Worker(URL.createObjectURL(blob), { type: "module" });
			w.onmessage = (event) => {
				const { id, type } = event.data;
				const job = pending.get(id);
				if (!job) return;
				if (type === "info") job.onInfo?.(event.data.info);
				else {
					pending.delete(id);
					if (type === "done") job.resolve(event.data.result);
					else job.reject(new Error(event.data.message));
				}
			};
			w.onerror = (event) => {
				event.preventDefault?.();
				// the worker could not load: run on the page from now on
				worker = null;
				w.terminate();
				for (const [id, job] of pending) {
					pending.delete(id);
					runLocal(job.msg, job.onInfo).then(job.resolve, job.reject);
				}
			};
			worker = w;
		} catch {
			worker = null;
		}
	}

	async function runLocal(msg, onInfo) {
		if (!local) {
			const m = await import("./engine.js");
			local = { ...m, engine: new m.Engine(19) };
		}
		// let the page paint the move that was just made before thinking
		await new Promise((r) => setTimeout(r, 30));
		const { chooseMove, positionFrom, uci, engine } = local;
		const pos = positionFrom(msg.fen, msg.moves ?? []);
		const white = pos.turn === 0;
		const report = (r) => ({
			move: r.move ? uci(r.move) : null,
			score: white ? r.score : -r.score,
			depth: r.depth,
			pv: (r.pv ?? []).map(uci),
			book: Boolean(r.book),
		});
		const r =
			msg.type === "analyse"
				? engine.search(pos, {
						ms: msg.ms ?? 1000,
						depth: msg.depth ?? 64,
						onInfo: (x) => onInfo?.(report(x)),
					})
				: chooseMove(engine, pos, msg.level, { ms: msg.ms });
		return report(r);
	}

	function send(msg, onInfo) {
		const id = ++seq;
		if (!worker && !local) start();
		return new Promise((resolve, reject) => {
			if (!worker) {
				runLocal(msg, onInfo).then(resolve, reject);
				return;
			}
			pending.set(id, { resolve, reject, onInfo, msg });
			worker.postMessage({ ...msg, id });
		});
	}

	return {
		move: (opts, onInfo) => send({ type: "move", ...opts }, onInfo),
		analyse: (opts, onInfo) => send({ type: "analyse", ...opts }, onInfo),
		/** Stop thinking now. A search cannot be interrupted from outside, so the worker is replaced. */
		cancel() {
			if (worker) {
				worker.terminate();
				worker = null;
			}
			for (const [id, job] of pending) {
				pending.delete(id);
				job.reject(Object.assign(new Error("cancelled"), { cancelled: true }));
			}
		},
		get busy() {
			return pending.size > 0;
		},
	};
}
