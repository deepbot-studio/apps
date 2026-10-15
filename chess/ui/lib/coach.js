/*
 * THE BOT AT THE TABLE: what the opponent says and how its face looks as the game goes. Short,
 * friendly, never mean; it notices a strong move, a slip, a check, the end. Written here so it
 * costs nothing per move (the engine decides; the Bot reacts). Nothing is said on every move: a
 * comment is the exception, not a running commentary.
 */
const LINES = {
	start: [
		["Good luck. Let's have a nice game.", "happy"],
		["Ready when you are.", "playful"],
		["Let's play. I'll try to be a worthy opponent.", "proud"],
		["New game, clean board. Your move.", "neutral"],
	],
	startBlack: [
		["I'll start, then.", "playful"],
		["My move first. Good luck.", "happy"],
	],
	thinking: [
		["Hmm, let me think.", "thinking"],
		["Interesting position...", "thinking"],
		["Give me a second.", "focus"],
	],
	strong: [
		["Oh, that's a good move.", "surprised"],
		["Nicely played.", "surprised"],
		["I didn't see that coming.", "scared"],
		["Strong. I need to be careful now.", "focus"],
	],
	slip: [
		["Are you sure about that one?", "playful"],
		["Thank you, I'll take that.", "happy"],
		["That might have been a mistake.", "playful"],
		["Hm, I think I can use that.", "proud"],
	],
	bigSlip: [
		["Ouch. That piece was hanging.", "surprised"],
		["You might want to take that back.", "confused"],
		["That one hurts. Want a takeback?", "sad"],
	],
	checkGiven: [
		["Check.", "proud"],
		["Check! Watch your king.", "playful"],
	],
	checkTaken: [
		["Check, yes. I see it.", "focus"],
		["Careful with my king, please.", "scared"],
	],
	capture: [
		["Thanks for the piece.", "happy"],
		["Mine now.", "playful"],
	],
	lost: [
		["Well played. You got me.", "sad"],
		["You won, fair and square. Again?", "happy"],
		["Good game. I'll remember that one.", "sad"],
	],
	won: [
		["Good game! You'll get me next time.", "celebrate"],
		["Checkmate. That was fun, want a rematch?", "celebrate"],
		["Got you this time. Want to see where it turned?", "proud"],
	],
	draw: [
		["A draw. Nobody got the better of anyone.", "neutral"],
		["Half a point each. Fair enough.", "happy"],
	],
	hint: [
		["Have a look at this one.", "playful"],
		["Here's what I'd consider.", "focus"],
	],
	takeback: [
		["Sure, take it back.", "happy"],
		["No problem, try again.", "playful"],
	],
	resigned: [["Thanks for the game. Shall we play again?", "happy"]],
	timeout: [["The clock ran out.", "surprised"]],
	botMoves: [
		["My turn to think for myself. Here goes.", "thinking"],
		["Let me pick this one myself.", "focus"],
	],
	botConfused: [
		["I got a bit lost there, so the engine moved for me.", "confused"],
	],
};

const used = new Map();
function pick(list) {
	const last = used.get(list) ?? -1;
	let i = Math.floor(Math.random() * list.length);
	if (list.length > 1 && i === last) i = (i + 1) % list.length;
	used.set(list, i);
	return list[i];
}

/** A line for an event: { text, mood }, or null when the Bot keeps quiet this time. */
export function say(event, { chance = 1 } = {}) {
	const list = LINES[event];
	if (!list || Math.random() > chance) return null;
	const [text, mood] = pick(list);
	return { text, mood };
}

/**
 * What the Bot thinks of the person's last move, from the engine's score before and after it
 * (both from the person's side, centipawns). Returns an event name or null.
 */
export function judge(before, after) {
	if (before == null || after == null) return null;
	const drop = before - after;
	if (drop >= 280) return "bigSlip";
	if (drop >= 120) return "slip";
	if (drop <= -150 && before < 300) return "strong";
	return null;
}
