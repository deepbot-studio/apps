/*
 * GAMES: every finished game (PGN files in chess/games, which the Bot can read too), the score
 * against each level, and a way in for a game from elsewhere (paste a PGN). Open one to review it.
 */
import { LEVELS } from "./engine.js";
import { Game } from "./rules.js";
import { deleteGame, listGames } from "./store.js";
import { armed, esc, icon, toast } from "./ui.js";

function when(ms) {
	const d = new Date(ms);
	const days = Math.floor((Date.now() - ms) / 86_400_000);
	if (days === 0)
		return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	if (days === 1) return "Yesterday";
	if (days < 7) return `${days} days ago`;
	return d.toLocaleDateString();
}

export async function mountGames(app, el) {
	el.innerHTML = `<div class="page"><div class="page-in"><div class="page-head"><div><h1>Your games</h1><p class="lead">Every finished game is kept, so you can look back at it with the engine, or ask your Bot about it.</p></div>
		<button class="btn" data-import>${icon("upload")}Review a PGN</button></div>
		<div class="paste" data-paste hidden><textarea rows="6" placeholder="Paste a game in PGN, from any chess site…" aria-label="PGN"></textarea><div class="row"><button class="btn primary" data-open>Review it</button><button class="btn ghost" data-cancel>Cancel</button></div></div>
		<div class="stats" data-stats></div>
		<div class="glist" data-list><p class="muted">Looking for your games…</p></div></div></div>`;
	const stats = app.progress.stats ?? {};
	const rows = [...Object.keys(LEVELS), "bot"]
		.filter((k) => stats[k])
		.map((k) => {
			const s = stats[k];
			const label = k === "bot" ? `${app.bot().name} itself` : LEVELS[k].label;
			return `<div class="stat"><span class="muted small">${esc(label)}</span><b>${s.w} – ${s.d} – ${s.l}</b><span class="muted small">won · drawn · lost</span></div>`;
		});
	el.querySelector("[data-stats]").innerHTML = rows.join("");

	const paste = el.querySelector("[data-paste]");
	el.querySelector("[data-import]").onclick = () => {
		paste.hidden = !paste.hidden;
		if (!paste.hidden) paste.querySelector("textarea").focus();
	};
	el.querySelector("[data-cancel]").onclick = () => {
		paste.hidden = true;
	};
	el.querySelector("[data-open]").onclick = () => {
		const text = paste.querySelector("textarea").value.trim();
		if (!text) return;
		try {
			Game.fromPgn(text);
		} catch (error) {
			toast(error.message, "error");
			return;
		}
		app.go("review", { pgn: text, from: "games" });
	};

	const list = el.querySelector("[data-list]");
	const games = await listGames();
	if (!games.length) {
		list.innerHTML = `<div class="empty-state"><p>No finished games yet.</p><button class="btn primary" data-play>${icon("play")}Play a game</button></div>`;
		list.querySelector("[data-play]").onclick = () =>
			app.go("play", { setup: true });
		return {};
	}
	list.innerHTML = games
		.map((g, i) => {
			const h = g.headers;
			const you = h.White === "You" ? "w" : h.Black === "You" ? "b" : null;
			const res = h.Result ?? "*";
			const outcome = !you
				? res
				: res === "1/2-1/2"
					? "Draw"
					: (res === "1-0") === (you === "w")
						? "Won"
						: res === "*"
							? "Unfinished"
							: "Lost";
			const opp =
				you === "w"
					? h.Black
					: you === "b"
						? h.White
						: `${h.White} vs ${h.Black}`;
			const moves = (g.pgn.split("\n\n")[1] ?? "").match(/\d+\./g)?.length ?? 0;
			return `<div class="grow-row" data-i="${i}"><button class="gopen" data-open-i="${i}"><span class="res ${outcome.toLowerCase()}">${esc(outcome)}</span>
				<span class="gtitle"><b>${you ? `vs ${esc(opp)}` : esc(opp)}</b><span class="muted small">${esc(h.Level ?? "")}${h.Level ? " · " : ""}${moves} ${moves === 1 ? "move" : "moves"}${h.Termination ? ` · ${esc(h.Termination)}` : ""}</span></span>
				<span class="muted small">${esc(when(g.modified))}</span></button>
				<button class="iconbtn" data-del="${i}" title="Delete this game" aria-label="Delete this game">${icon("trash")}</button></div>`;
		})
		.join("");
	for (const b of list.querySelectorAll("[data-open-i]"))
		b.onclick = () => {
			const g = games[Number(b.dataset.openI)];
			app.go("review", { pgn: g.pgn, path: g.path, from: "games" });
		};
	for (const b of list.querySelectorAll("[data-del]"))
		armed(b, "Delete", async () => {
			const g = games[Number(b.dataset.del)];
			try {
				await deleteGame(g.path);
				b.closest(".grow-row").remove();
				toast("The game is deleted.");
			} catch (error) {
				toast(error?.message ?? String(error), "error");
			}
		});
	return {};
}
