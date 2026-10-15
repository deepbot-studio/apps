/*
 * THE SOUNDS: a wooden piece set down, a capture, check, castling, the clock running low, the end
 * of a game. Made on the spot with Web Audio (filtered noise for wood, sine tones for bells), so
 * there are no sound files and nothing to licence. Silent until the first click (browsers insist).
 */
let ctx = null;
let master = null;
let enabled = true;
let volume = 0.7;

function audio() {
	if (!enabled) return null;
	if (!ctx) {
		try {
			ctx = new (window.AudioContext || window.webkitAudioContext)();
			master = ctx.createGain();
			master.gain.value = volume;
			master.connect(ctx.destination);
		} catch {
			return null;
		}
	}
	if (ctx.state === "suspended") ctx.resume().catch(() => {});
	return ctx;
}

let noiseBuffer = null;
function noise(a) {
	if (noiseBuffer) return noiseBuffer;
	const len = Math.floor(a.sampleRate * 0.4);
	noiseBuffer = a.createBuffer(1, len, a.sampleRate);
	const d = noiseBuffer.getChannelData(0);
	for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
	return noiseBuffer;
}

/** One knock of wood on wood. */
function knock(
	a,
	at,
	{ freq = 1100, q = 6, gain = 0.9, length = 0.09, thump = 150 } = {},
) {
	const src = a.createBufferSource();
	src.buffer = noise(a);
	const band = a.createBiquadFilter();
	band.type = "bandpass";
	band.frequency.value = freq;
	band.Q.value = q;
	const g = a.createGain();
	g.gain.setValueAtTime(0, at);
	g.gain.linearRampToValueAtTime(gain, at + 0.004);
	g.gain.exponentialRampToValueAtTime(0.001, at + length);
	src.connect(band).connect(g).connect(master);
	src.start(at);
	src.stop(at + length + 0.02);
	// the body of the board answering
	const o = a.createOscillator();
	o.type = "sine";
	o.frequency.setValueAtTime(thump, at);
	o.frequency.exponentialRampToValueAtTime(thump * 0.6, at + length);
	const og = a.createGain();
	og.gain.setValueAtTime(0, at);
	og.gain.linearRampToValueAtTime(gain * 0.55, at + 0.003);
	og.gain.exponentialRampToValueAtTime(0.001, at + length * 1.2);
	o.connect(og).connect(master);
	o.start(at);
	o.stop(at + length * 1.3);
}

function tone(a, at, freq, { length = 0.5, gain = 0.25, type = "sine" } = {}) {
	const o = a.createOscillator();
	o.type = type;
	o.frequency.value = freq;
	const g = a.createGain();
	g.gain.setValueAtTime(0, at);
	g.gain.linearRampToValueAtTime(gain, at + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0008, at + length);
	o.connect(g).connect(master);
	o.start(at);
	o.stop(at + length + 0.05);
}

const SOUNDS = {
	move(a, t) {
		knock(a, t, { freq: 900 + Math.random() * 250 });
	},
	capture(a, t) {
		knock(a, t, { freq: 1500, q: 4, gain: 1, length: 0.07, thump: 190 });
		knock(a, t + 0.055, { freq: 950, gain: 0.75, length: 0.1 });
	},
	castle(a, t) {
		knock(a, t, { freq: 1000 });
		knock(a, t + 0.14, { freq: 850, gain: 0.8 });
	},
	check(a, t) {
		knock(a, t, { freq: 1000 });
		tone(a, t + 0.03, 1318.5, { length: 0.45, gain: 0.12 });
		tone(a, t + 0.03, 1975.5, { length: 0.3, gain: 0.05 });
	},
	promote(a, t) {
		knock(a, t, { freq: 1000 });
		tone(a, t + 0.04, 784, { length: 0.25, gain: 0.12 });
		tone(a, t + 0.12, 1175, { length: 0.4, gain: 0.12 });
	},
	illegal(a, t) {
		tone(a, t, 180, { length: 0.14, gain: 0.12, type: "triangle" });
	},
	select(a, t) {
		knock(a, t, { freq: 2200, q: 10, gain: 0.18, length: 0.03, thump: 400 });
	},
	start(a, t) {
		tone(a, t, 523.25, { length: 0.5, gain: 0.1 });
		tone(a, t + 0.1, 783.99, { length: 0.6, gain: 0.1 });
	},
	win(a, t) {
		for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries())
			tone(a, t + i * 0.11, f, { length: 0.7, gain: 0.12 });
	},
	lose(a, t) {
		for (const [i, f] of [392, 349.23, 293.66].entries())
			tone(a, t + i * 0.16, f, { length: 0.7, gain: 0.11, type: "triangle" });
	},
	draw(a, t) {
		tone(a, t, 440, { length: 0.6, gain: 0.1 });
		tone(a, t + 0.15, 440, { length: 0.6, gain: 0.08 });
	},
	tick(a, t) {
		knock(a, t, { freq: 3200, q: 12, gain: 0.22, length: 0.025, thump: 900 });
	},
	correct(a, t) {
		tone(a, t, 880, { length: 0.25, gain: 0.1 });
		tone(a, t + 0.08, 1318.5, { length: 0.4, gain: 0.1 });
	},
	wrong(a, t) {
		tone(a, t, 311, { length: 0.25, gain: 0.1, type: "triangle" });
		tone(a, t + 0.1, 233, { length: 0.35, gain: 0.1, type: "triangle" });
	},
};

export function play(name) {
	const a = audio();
	if (!a || !SOUNDS[name]) return;
	try {
		SOUNDS[name](a, a.currentTime + 0.005);
	} catch {
		/* a sound is never worth an error */
	}
}

/** The sound a move makes. */
export function moveSound(mv, { check, mate } = {}) {
	if (mate) return "check";
	if (check) return "check";
	if (mv.promotion) return "promote";
	if (mv.castle) return "castle";
	if (mv.captured) return "capture";
	return "move";
}

export function setSound(on) {
	enabled = Boolean(on);
}
export function setVolume(v) {
	volume = Math.max(0, Math.min(1, v));
	if (master) master.gain.value = volume;
}
export const soundOn = () => enabled;
