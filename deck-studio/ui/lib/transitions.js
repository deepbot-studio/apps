/*
 * TRANSITIONS between slides, when presenting and in the exported web page: one for the deck
 * (`deck.transition`), and any slide may have its own (`slide.transition`), used when it comes in.
 * The same keyframes run in both places (the web page gets them inline).
 */

export const TRANSITIONS = {
	none: { name: "None" },
	fade: { name: "Fade" },
	slide: { name: "Slide" },
	push: { name: "Push" },
	zoom: { name: "Zoom" },
	rise: { name: "Rise" },
	flip: { name: "Flip" },
};

/** Keyframes for [incoming, outgoing]; dir 1 forward, -1 back. */
export function keyframes(kind, dir = 1) {
	const d = dir < 0 ? -1 : 1;
	switch (kind) {
		case "fade":
			return [[{ opacity: 0 }, { opacity: 1 }], null];
		case "slide":
			return [
				[
					{ transform: `translateX(${d * 100}%)`, opacity: 0.4 },
					{ transform: "translateX(0)", opacity: 1 },
				],
				null,
			];
		case "push":
			return [
				[
					{ transform: `translateX(${d * 100}%)` },
					{ transform: "translateX(0)" },
				],
				[
					{ transform: "translateX(0)" },
					{ transform: `translateX(${-d * 100}%)` },
				],
			];
		case "zoom":
			return [
				[
					{ transform: "scale(.86)", opacity: 0 },
					{ transform: "scale(1)", opacity: 1 },
				],
				[
					{ transform: "scale(1)", opacity: 1 },
					{ transform: "scale(1.08)", opacity: 0 },
				],
			];
		case "rise":
			return [
				[
					{ transform: "translateY(8%)", opacity: 0 },
					{ transform: "translateY(0)", opacity: 1 },
				],
				null,
			];
		case "flip":
			return [
				[
					{
						transform: `perspective(2000px) rotateY(${d * 70}deg)`,
						opacity: 0,
					},
					{ transform: "perspective(2000px) rotateY(0)", opacity: 1 },
				],
				[
					{ transform: "perspective(2000px) rotateY(0)", opacity: 1 },
					{
						transform: `perspective(2000px) rotateY(${-d * 70}deg)`,
						opacity: 0,
					},
				],
			];
		default:
			return [null, null];
	}
}

export const DURATION = 520;

export function transitionOf(deck, slide) {
	const k = slide?.transition || deck?.transition || "fade";
	return TRANSITIONS[k] ? k : "fade";
}

/**
 * Run a transition: `incoming` and `outgoing` are two stacked elements (the old one is removed when
 * done). Resolves when it is over.
 */
export function play(kind, incoming, outgoing, dir = 1) {
	const [inK, outK] = keyframes(kind, dir);
	const opts = { duration: DURATION, easing: "cubic-bezier(.22,.8,.24,1)" };
	const runs = [];
	if (inK && incoming?.animate) runs.push(incoming.animate(inK, opts).finished);
	if (outK && outgoing?.animate)
		runs.push(outgoing.animate(outK, { ...opts, fill: "forwards" }).finished);
	return Promise.all(runs)
		.catch(() => {})
		.then(() => outgoing?.remove());
}

/** The same, as source for the exported web page. */
export const PLAY_SOURCE = `const DURATION=${DURATION};${keyframes.toString()};function play(kind,incoming,outgoing,dir){const [a,b]=keyframes(kind,dir);const o={duration:DURATION,easing:"cubic-bezier(.22,.8,.24,1)"};const r=[];if(a&&incoming.animate)r.push(incoming.animate(a,o).finished);if(b&&outgoing&&outgoing.animate)r.push(outgoing.animate(b,Object.assign({},o,{fill:"forwards"})).finished);return Promise.all(r).catch(()=>{});}`;
