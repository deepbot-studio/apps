/*
 * SMALL SHARED PIECES OF THE INTERFACE: escaping, icons, toasts, a confirm-on-second-click button,
 * the Bot's face, time formatting.
 */
export const esc = (s) =>
	String(s ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);

// 24x24 stroke icons, drawn for this app
export const ICONS = {
	hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
	undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
	flip: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
	flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
	draw: '<path d="M4 12h16"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="17" r="1.5"/>',
	soundOn:
		'<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
	soundOff: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="m17 9 5 6M22 9l-5 6"/>',
	cube: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
	grid: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12h16M12 4v16"/><path d="M4 8h4M8 4v8M12 16h4M16 12v8" opacity=".55"/>',
	ask: '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
	play: '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
	pause: '<path d="M8 5v14M16 5v14"/>',
	first: '<path d="M6 5v14M18 6l-8 6 8 6V6z"/>',
	prev: '<path d="M15 6l-6 6 6 6"/>',
	next: '<path d="M9 6l6 6-6 6"/>',
	last: '<path d="M18 5v14M6 6l8 6-8 6V6z"/>',
	refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
	download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
	upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
	trophy:
		'<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4"/>',
	book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
	puzzle:
		'<path d="M10 4a2 2 0 1 1 4 0v2h4v4h2a2 2 0 1 1 0 4h-2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4H4a2 2 0 1 1 0-4h2V6h4V4z"/>',
	clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/>',
	x: '<path d="M6 6l12 12M18 6 6 18"/>',
	check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
	knight:
		'<path d="M7 21h11M8 21c0-3 1.5-5 4-7-2 0-4 .5-5.5-1-.8-.9.2-2.6 1.5-3.8C9 8.3 9.5 7 10 6l.5-2.5L12 5c3.5.5 6 3.7 6 8 0 3.5-1 5.5-.5 8"/>',
	view: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
	lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
	star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5z"/>',
	bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3z"/>',
	copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
	trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
	more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
	target:
		'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
	chart: '<path d="M4 20V4M4 20h16"/><path d="m7 15 4-4 3 3 5-6"/>',
};

export function icon(name, cls = "") {
	return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}

let toastTimer = 0;
export function toast(text, kind = "") {
	let el = document.querySelector(".toast");
	if (!el) {
		el = document.createElement("div");
		el.className = "toast";
		el.setAttribute("role", "status");
		document.body.appendChild(el);
	}
	el.textContent = text;
	el.className = `toast show ${kind}`;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(
		() => el.classList.remove("show"),
		kind === "error" ? 5200 : 2600,
	);
}

/** A button that asks "Sure?" on the first click and acts on the second (no confirm() in a frame). */
export function armed(button, label, act) {
	let timer = 0;
	const original = button.innerHTML;
	button.addEventListener("click", () => {
		if (button.classList.contains("armed")) {
			clearTimeout(timer);
			button.classList.remove("armed");
			button.innerHTML = original;
			act();
			return;
		}
		button.classList.add("armed");
		button.textContent = label;
		timer = setTimeout(() => {
			button.classList.remove("armed");
			button.innerHTML = original;
		}, 3000);
	});
}

export function clockText(ms) {
	if (ms == null) return "";
	const t = Math.max(0, ms);
	if (t < 10_000)
		return `${Math.floor(t / 1000)}.${Math.floor((t % 1000) / 100)}`;
	const s = Math.ceil(t / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = String(s % 60).padStart(2, "0");
	return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** The Bot's face for a mood, from the faces DeepBot sent (or a drawn stand-in). */
const MOOD_FACE = {
	idle: "neutral",
	thinking: "look-up-left",
	focus: "focus",
	happy: "happy",
	proud: "proud",
	celebrate: "celebrate",
	sad: "sad",
	surprised: "surprised",
	playful: "playful",
	confused: "confused",
	laugh: "laugh",
	scared: "scared",
};
export function faceSvg(bot, mood = "idle") {
	const faces = bot?.faces ?? {};
	const svg = faces[MOOD_FACE[mood] ?? "neutral"] ?? faces.neutral;
	if (svg) return svg;
	// no faces from DeepBot (an older one): a simple round face
	const mouth =
		{
			happy: "M38 62q12 10 24 0",
			celebrate: "M36 60q14 16 28 0z",
			laugh: "M36 60q14 16 28 0z",
			proud: "M40 62q10 6 20 0",
			sad: "M38 68q12-9 24 0",
			surprised: "M46 64a4 5 0 1 0 8 0a4 5 0 1 0-8 0",
			scared: "M40 66q10-6 20 0",
		}[mood] ?? "M40 64h20";
	return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#7c9cff"/><circle cx="38" cy="44" r="5" fill="#14161c"/><circle cx="62" cy="44" r="5" fill="#14161c"/><path d="${mouth}" fill="${mouth.endsWith("z") ? "#14161c" : "none"}" stroke="#14161c" stroke-width="4" stroke-linecap="round"/></svg>`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function download(name, text, type = "text/plain") {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([text], { type }));
	a.download = name;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		URL.revokeObjectURL(a.href);
		a.remove();
	}, 1000);
}
