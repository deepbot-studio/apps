/*
 * THE 3D BOARD: a wooden board on a table, Staunton-style pieces turned on a lathe (built here in
 * code, no model files), soft shadows, polished boxwood and ebony that catch the light, pieces that
 * glide, a knight that hops, captured pieces that leave the board and stand beside it.
 *
 * The same interface as the 2D board (see board2d.js): set(), orient(), select(), rectOf(),
 * resize(), destroy(), plus setTheme(dark) and resetView(). Click a piece and a square, or drag; the
 * view can be turned with the right mouse button or two fingers, and snaps back with resetView().
 *
 * three.js comes from DeepBot itself (/vendor/three, the bundle the 3D gallery uses), loaded once.
 */
const FILES = "abcdefgh";

let loading = null;
export function loadThree() {
	if (window.THREE && window.THREE_ADDONS) return Promise.resolve(window.THREE);
	if (!loading)
		loading = new Promise((resolve, reject) => {
			const s = document.createElement("script");
			s.src = "/vendor/three/deepbot-three-r186-2.js";
			s.onload = () =>
				window.THREE
					? resolve(window.THREE)
					: reject(new Error("three.js did not load"));
			s.onerror = () => reject(new Error("three.js could not be loaded"));
			document.head.appendChild(s);
		});
	return loading;
}

/** Can this computer draw WebGL at all? (Otherwise the page uses the 2D board.) */
export function webglWorks() {
	try {
		const c = document.createElement("canvas");
		return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
	} catch {
		return false;
	}
}

// a seeded random, so the wood grain is the same every time
function rng(seed) {
	let s = seed >>> 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return (s >>> 0) / 4294967296;
	};
}

/** Paint wood: a base colour and fine grain lines running one way. */
function paintWood(ctx, x, y, w, h, base, grain, rand, vertical) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();
	ctx.fillStyle = base;
	ctx.fillRect(x, y, w, h);
	const lines = Math.round((vertical ? w : h) / 3.2);
	for (let i = 0; i < lines; i++) {
		const t = (i + rand()) / lines;
		const alpha = 0.03 + rand() * 0.09;
		ctx.strokeStyle = grain.replace("A", alpha.toFixed(3));
		ctx.lineWidth = 0.6 + rand() * 1.6;
		ctx.beginPath();
		const amp = 2 + rand() * 6;
		const freq = 0.004 + rand() * 0.01;
		const phase = rand() * 10;
		const steps = 24;
		for (let k = 0; k <= steps; k++) {
			const u = k / steps;
			const wave = Math.sin(phase + u * (vertical ? h : w) * freq * 6.28) * amp;
			const px = vertical ? x + t * w + wave : x + u * w;
			const py = vertical ? y + u * h : y + t * h + wave;
			if (k === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.stroke();
	}
	// a little sheen across the plank
	const g = vertical
		? ctx.createLinearGradient(x, 0, x + w, 0)
		: ctx.createLinearGradient(0, y, 0, y + h);
	g.addColorStop(0, "rgba(255,255,255,0.05)");
	g.addColorStop(0.5, "rgba(255,255,255,0)");
	g.addColorStop(1, "rgba(0,0,0,0.06)");
	ctx.fillStyle = g;
	ctx.fillRect(x, y, w, h);
	ctx.restore();
}

const BOARD = 8; // playing area, in squares
const FRAME = 0.62; // border width, in squares
const TOTAL = BOARD + FRAME * 2;

function boardTexture(THREE, maxAniso) {
	const px = 2048;
	const c = document.createElement("canvas");
	c.width = px;
	c.height = px;
	const ctx = c.getContext("2d");
	const unit = px / TOTAL;
	const rand = rng(7);
	// the frame: walnut planks
	paintWood(ctx, 0, 0, px, px, "#4a3122", "rgba(20,10,4,A)", rand, false);
	ctx.strokeStyle = "rgba(0,0,0,0.35)";
	ctx.lineWidth = 3;
	ctx.strokeRect(
		FRAME * unit - 6,
		FRAME * unit - 6,
		BOARD * unit + 12,
		BOARD * unit + 12,
	);
	ctx.strokeStyle = "rgba(255,220,170,0.25)";
	ctx.lineWidth = 2;
	ctx.strokeRect(
		FRAME * unit - 10,
		FRAME * unit - 10,
		BOARD * unit + 20,
		BOARD * unit + 20,
	);
	// the squares: maple and walnut, grain alternating
	for (let r = 0; r < 8; r++)
		for (let f = 0; f < 8; f++) {
			const light = (f + r) % 2 === 1;
			const x = (FRAME + f) * unit;
			const y = (FRAME + 7 - r) * unit;
			paintWood(
				ctx,
				x,
				y,
				unit,
				unit,
				light ? "#dcbf91" : "#75482c",
				light ? "rgba(110,70,30,A)" : "rgba(30,12,4,A)",
				rand,
				(f + r) % 2 === 0,
			);
		}
	// coordinates on the frame, readable from each player's side
	ctx.fillStyle = "rgba(240,220,190,0.78)";
	ctx.font = `600 ${Math.round(unit * 0.3)}px Lexend, system-ui, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const mid = (FRAME / 2) * unit;
	for (let i = 0; i < 8; i++) {
		const along = (FRAME + i + 0.5) * unit;
		ctx.fillText(FILES[i], along, px - mid);
		ctx.fillText(String(8 - i), mid, along);
		ctx.save();
		ctx.translate(along, mid);
		ctx.rotate(Math.PI);
		ctx.fillText(FILES[i], 0, 0);
		ctx.restore();
		ctx.save();
		ctx.translate(px - mid, along);
		ctx.rotate(Math.PI);
		ctx.fillText(String(8 - i), 0, 0);
		ctx.restore();
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = maxAniso;
	return tex;
}

/** Points of a circular arc in the lathe's (radius, height) plane. */
function arc(cy, r, from, to, n = 10) {
	const out = [];
	for (let i = 0; i <= n; i++) {
		const a = from + ((to - from) * i) / n;
		out.push([Math.cos(a) * r, cy + Math.sin(a) * r]);
	}
	return out;
}
const foot = (r) => [
	[0, 0],
	[r, 0],
	[r, 0.045],
	[r - 0.025, 0.07],
	[r - 0.015, 0.095],
	[r - 0.07, 0.125],
];

const PROFILES = {
	p: [
		...foot(0.33),
		[0.24, 0.14],
		[0.17, 0.22],
		[0.125, 0.33],
		[0.11, 0.4],
		[0.17, 0.415],
		[0.17, 0.45],
		[0.1, 0.465],
		...arc(0.575, 0.125, -1.2, Math.PI / 2, 12),
	],
	r: [
		...foot(0.36),
		[0.27, 0.15],
		[0.235, 0.22],
		[0.21, 0.5],
		[0.25, 0.53],
		[0.26, 0.57],
		[0.27, 0.68],
		[0.2, 0.68],
		[0.2, 0.62],
		[0, 0.62],
	],
	n: [
		...foot(0.36),
		[0.27, 0.15],
		[0.24, 0.22],
		[0.27, 0.25],
		[0.26, 0.28],
		[0, 0.28],
	],
	b: [
		...foot(0.34),
		[0.245, 0.15],
		[0.175, 0.24],
		[0.12, 0.5],
		[0.19, 0.525],
		[0.19, 0.56],
		[0.11, 0.58],
		[0.15, 0.64],
		[0.165, 0.7],
		[0.15, 0.77],
		[0.1, 0.83],
		[0.045, 0.86],
		[0, 0.865],
	],
	q: [
		...foot(0.37),
		[0.27, 0.15],
		[0.195, 0.26],
		[0.13, 0.6],
		[0.2, 0.635],
		[0.2, 0.67],
		[0.13, 0.69],
		[0.19, 0.84],
		[0.215, 0.88],
		[0.2, 0.9],
		[0.13, 0.885],
		[0.07, 0.9],
		[0, 0.905],
	],
	k: [
		...foot(0.38),
		[0.28, 0.15],
		[0.205, 0.26],
		[0.14, 0.66],
		[0.215, 0.695],
		[0.215, 0.73],
		[0.14, 0.75],
		[0.2, 0.9],
		[0.215, 0.94],
		[0, 0.945],
	],
};

function pieceGeometries(THREE, merge) {
	const out = {};
	const lathe = (pts) =>
		new THREE.LatheGeometry(
			pts.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)),
			48,
		);
	const clean = (g) => {
		// mergeable: no index, the same attributes everywhere
		const n = g.index ? g.toNonIndexed() : g;
		for (const key of Object.keys(n.attributes))
			if (key !== "position" && key !== "normal") n.deleteAttribute(key);
		return n;
	};
	for (const t of ["p", "b"]) out[t] = clean(lathe(PROFILES[t]));
	// bishop: a ball on the mitre
	{
		const ball = new THREE.SphereGeometry(0.045, 16, 12);
		ball.translate(0, 0.9, 0);
		const slit = new THREE.TorusGeometry(0.13, 0.012, 8, 32);
		slit.rotateX(Math.PI / 2);
		slit.translate(0, 0.585, 0);
		out.b = merge([out.b, clean(ball), clean(slit)]);
	}
	// rook: battlements
	{
		const parts = [clean(lathe(PROFILES.r))];
		for (let i = 0; i < 6; i++) {
			const m = new THREE.BoxGeometry(0.1, 0.09, 0.075);
			m.translate(0, 0.725, 0.235);
			m.rotateY((i / 6) * Math.PI * 2);
			parts.push(clean(m));
		}
		out.r = merge(parts);
	}
	// queen: a coronet of pearls and one on top
	{
		const parts = [clean(lathe(PROFILES.q))];
		for (let i = 0; i < 9; i++) {
			const s = new THREE.SphereGeometry(0.036, 12, 10);
			s.translate(0, 0.905, 0.19);
			s.rotateY((i / 9) * Math.PI * 2);
			parts.push(clean(s));
		}
		const top = new THREE.SphereGeometry(0.058, 16, 12);
		top.translate(0, 0.96, 0);
		parts.push(clean(top));
		out.q = merge(parts);
	}
	// king: the cross
	{
		const v = new THREE.BoxGeometry(0.055, 0.22, 0.055);
		v.translate(0, 1.05, 0);
		const h = new THREE.BoxGeometry(0.17, 0.055, 0.055);
		h.translate(0, 1.08, 0);
		const knob = new THREE.SphereGeometry(0.05, 16, 10);
		knob.translate(0, 0.95, 0);
		out.k = merge([clean(lathe(PROFILES.k)), clean(v), clean(h), clean(knob)]);
	}
	// knight: a turned base and a carved horse's head
	{
		const s = new THREE.Shape();
		s.moveTo(-0.17, 0);
		s.lineTo(0.17, 0);
		s.quadraticCurveTo(0.22, 0.12, 0.12, 0.2);
		s.quadraticCurveTo(0.2, 0.22, 0.27, 0.255);
		s.quadraticCurveTo(0.34, 0.29, 0.31, 0.36);
		s.quadraticCurveTo(0.24, 0.44, 0.13, 0.5);
		s.lineTo(0.09, 0.6);
		s.lineTo(0.03, 0.53);
		s.quadraticCurveTo(-0.16, 0.54, -0.22, 0.32);
		s.quadraticCurveTo(-0.25, 0.14, -0.17, 0);
		const head = new THREE.ExtrudeGeometry(s, {
			depth: 0.16,
			bevelEnabled: true,
			bevelThickness: 0.045,
			bevelSize: 0.035,
			bevelSegments: 4,
			curveSegments: 18,
		});
		head.translate(0, 0, -0.08);
		head.translate(0, 0.25, 0);
		const eyeL = new THREE.SphereGeometry(0.022, 8, 6);
		eyeL.translate(0.17, 0.42, 0.12);
		const eyeR = new THREE.SphereGeometry(0.022, 8, 6);
		eyeR.translate(0.17, 0.42, -0.12);
		out.n = merge([
			clean(lathe(PROFILES.n)),
			clean(head),
			clean(eyeL),
			clean(eyeR),
		]);
	}
	for (const g of Object.values(out)) g.computeVertexNormals?.();
	return out;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export async function createBoard3d(
	host,
	{ orientation = "w", onMove, onSelect, dark = false, tray = true } = {},
) {
	const THREE = await loadThree();
	const A = window.THREE_ADDONS;
	const { OrbitControls } = A["controls/OrbitControls.js"];
	const { RoomEnvironment } = A["environments/RoomEnvironment.js"];
	const { RoundedBoxGeometry } = A["geometries/RoundedBoxGeometry.js"];
	const { mergeGeometries } = A["utils/BufferGeometryUtils.js"];
	const merge = (parts) => mergeGeometries(parts, false);

	const el = document.createElement("div");
	el.className = "b3";
	host.appendChild(el);

	const renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: false,
		powerPreference: "high-performance",
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	el.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	const pmrem = new THREE.PMREMGenerator(renderer);
	const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = envTex;
	scene.environmentIntensity = 0.55;

	const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enablePan = false;
	controls.enableDamping = true;
	controls.dampingFactor = 0.09;
	controls.minPolarAngle = 0.12;
	controls.maxPolarAngle = 1.18;
	controls.minDistance = 7;
	controls.maxDistance = 30;
	controls.rotateSpeed = 0.6;
	// left button is for the pieces; turning the view is right button, or two fingers
	controls.mouseButtons = {
		LEFT: null,
		MIDDLE: THREE.MOUSE.DOLLY,
		RIGHT: THREE.MOUSE.ROTATE,
	};
	controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };

	// lights: a soft sky, a warm key lamp with shadows, a cool rim from behind
	const hemi = new THREE.HemisphereLight(0xfff4e6, 0x3a2a20, 0.55);
	scene.add(hemi);
	const key = new THREE.SpotLight(0xfff0dc, 520, 60, 0.62, 0.55, 1.6);
	key.position.set(-5, 15, 7);
	key.target.position.set(0, 0, 0);
	scene.add(key.target);
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	key.shadow.camera.near = 4;
	key.shadow.camera.far = 40;
	key.shadow.bias = -0.0003;
	key.shadow.normalBias = 0.02;
	key.shadow.radius = 3;
	key.shadow.blurSamples = 16;
	scene.add(key);
	const rim = new THREE.DirectionalLight(0xcfe0ff, 0.6);
	rim.position.set(6, 6, -8);
	scene.add(rim);

	// the table and the board
	const tableMat = new THREE.MeshStandardMaterial({
		color: 0x2a221c,
		roughness: 0.92,
	});
	const table = new THREE.Mesh(new THREE.CircleGeometry(60, 64), tableMat);
	table.rotation.x = -Math.PI / 2;
	table.position.y = -0.36;
	table.receiveShadow = true;
	scene.add(table);

	const aniso = renderer.capabilities.getMaxAnisotropy();
	const boardTex = boardTexture(THREE, aniso);
	const sideTex = boardTex.clone();
	sideTex.needsUpdate = true;
	const topMat = new THREE.MeshPhysicalMaterial({
		map: boardTex,
		roughness: 0.5,
		clearcoat: 0.32,
		clearcoatRoughness: 0.3,
	});
	const sideMat = new THREE.MeshPhysicalMaterial({
		color: 0x3e281b,
		roughness: 0.5,
		clearcoat: 0.4,
		clearcoatRoughness: 0.3,
	});
	const frame = new THREE.Mesh(
		new RoundedBoxGeometry(TOTAL, 0.36, TOTAL, 4, 0.06),
		sideMat,
	);
	frame.position.y = -0.18;
	frame.receiveShadow = true;
	frame.castShadow = true;
	scene.add(frame);
	const top = new THREE.Mesh(
		new THREE.PlaneGeometry(TOTAL - 0.1, TOTAL - 0.1),
		topMat,
	);
	top.rotation.x = -Math.PI / 2;
	top.position.y = 0.002;
	top.receiveShadow = true;
	scene.add(top);

	// pieces
	const geos = pieceGeometries(THREE, merge);
	const matW = new THREE.MeshPhysicalMaterial({
		color: 0xdcc6a0,
		roughness: 0.34,
		clearcoat: 0.75,
		clearcoatRoughness: 0.18,
		sheen: 0.25,
		sheenColor: new THREE.Color(0xfff6e6),
	});
	const matB = new THREE.MeshPhysicalMaterial({
		color: 0x231a15,
		roughness: 0.28,
		clearcoat: 0.9,
		clearcoatRoughness: 0.12,
	});
	const pieceGroup = new THREE.Group();
	scene.add(pieceGroup);

	// marks drawn on the board
	const markGroup = new THREE.Group();
	markGroup.position.y = 0.006;
	scene.add(markGroup);
	const planeGeo = new THREE.PlaneGeometry(1, 1);
	planeGeo.rotateX(-Math.PI / 2);
	const dotGeo = new THREE.CircleGeometry(0.15, 32);
	dotGeo.rotateX(-Math.PI / 2);
	const ringGeo = new THREE.RingGeometry(0.4, 0.48, 48);
	ringGeo.rotateX(-Math.PI / 2);
	const flat = (color, opacity) =>
		new THREE.MeshBasicMaterial({
			color,
			transparent: true,
			opacity,
			depthWrite: false,
		});
	const MARK = {
		last: flat(0xf2c14e, 0.38),
		sel: flat(0x3fae7c, 0.5),
		hover: flat(0xffffff, 0.14),
		dot: flat(0x14231b, 0.42),
		ring: flat(0x14231b, 0.42),
		good: flat(0x3fae7c, 0.45),
		bad: flat(0xd9534f, 0.45),
		hint: flat(0x5aa9e6, 0.45),
		target: flat(0xf2c14e, 0.5),
	};
	const checkTex = (() => {
		const c = document.createElement("canvas");
		c.width = c.height = 128;
		const g = c.getContext("2d");
		const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
		grd.addColorStop(0, "rgba(255,40,30,0.95)");
		grd.addColorStop(0.5, "rgba(230,30,20,0.5)");
		grd.addColorStop(1, "rgba(200,0,0,0)");
		g.fillStyle = grd;
		g.fillRect(0, 0, 128, 128);
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		return t;
	})();
	const checkMat = new THREE.MeshBasicMaterial({
		map: checkTex,
		transparent: true,
		depthWrite: false,
	});

	const arrowGroup = new THREE.Group();
	arrowGroup.position.y = 0.012;
	scene.add(arrowGroup);
	const ARROW = {
		"": 0x3fae7c,
		best: 0x3fae7c,
		hint: 0x5aa9e6,
		bad: 0xd9534f,
		threat: 0xd9534f,
		alt: 0xf2c14e,
	};

	let orient = orientation;
	let state = { pieces: {}, movable: null };
	let selected = null;
	let hover = null;
	const meshes = new Map(); // square -> mesh
	const captured = []; // meshes standing beside the board
	const tweens = [];
	let raf = 0;
	let alive = true;

	const pos3 = (sq) =>
		new THREE.Vector3(FILES.indexOf(sq[0]) - 3.5, 0, 3.5 - (Number(sq[1]) - 1));

	function makePiece(code) {
		const mesh = new THREE.Mesh(geos[code[1]], code[0] === "w" ? matW : matB);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.userData.code = code;
		if (code[1] === "n")
			mesh.rotation.y = code[0] === "w" ? 0.5 : Math.PI + 0.5;
		pieceGroup.add(mesh);
		return mesh;
	}

	function tween(duration, step, done) {
		tweens.push({ start: performance.now(), duration, step, done });
		kick();
	}

	function glide(mesh, from, to, { hop = 0.12, ms = 280 } = {}) {
		return new Promise((resolve) => {
			const a = from.clone();
			const b = to.clone();
			tween(
				ms,
				(t) => {
					const e = ease(t);
					mesh.position.lerpVectors(a, b, e);
					mesh.position.y = Math.sin(Math.PI * t) * hop;
				},
				() => {
					mesh.position.copy(b);
					resolve();
				},
			);
		});
	}

	// where captured pieces stand: white's prisoners on white's right, black's on black's right
	function trayPos(colourTaken, index) {
		const row = Math.floor(index / 8);
		const i = index % 8;
		const side = colourTaken === "b" ? 1 : -1; // black pieces taken by white stand at +x
		const x = side * (TOTAL / 2 + 0.55 + row * 0.62);
		const z = side * (3.5 - i * 0.8);
		return new THREE.Vector3(x, -0.36, z);
	}

	function sendToTray(mesh) {
		if (!tray) {
			// no prisoners beside the board here (lessons, puzzles): the piece just leaves
			pieceGroup.remove(mesh);
			kick();
			return;
		}
		const colour = mesh.userData.code[0];
		const index = captured.filter((m) => m.userData.code[0] === colour).length;
		captured.push(mesh);
		const target = trayPos(colour, index);
		const from = mesh.position.clone();
		tween(
			420,
			(t) => {
				const e = ease(t);
				mesh.position.lerpVectors(from, target, e);
				mesh.position.y =
					from.y + (target.y - from.y) * e + Math.sin(Math.PI * t) * 0.9;
				const s = 1 - 0.18 * e;
				mesh.scale.set(s, s, s);
			},
			() => mesh.position.copy(target),
		);
	}

	function layoutTray(pieces) {
		if (!tray) return;
		// rebuild the prisoners from what is missing (after an undo, a new game, a loaded position)
		const counts = {};
		for (const code of Object.values(pieces))
			counts[code] = (counts[code] ?? 0) + 1;
		const full = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
		const want = [];
		for (const colour of ["w", "b"])
			for (const t of ["q", "r", "b", "n", "p"]) {
				const missing = Math.max(0, full[t] - (counts[colour + t] ?? 0));
				for (let i = 0; i < missing; i++) want.push(colour + t);
			}
		const have = captured
			.map((m) => m.userData.code)
			.sort()
			.join();
		if (have === [...want].sort().join()) return;
		for (const m of captured.splice(0)) pieceGroup.remove(m);
		const idx = { w: 0, b: 0 };
		for (const code of want) {
			const m = makePiece(code);
			m.position.copy(trayPos(code[0], idx[code[0]]++));
			m.scale.setScalar(0.82);
			captured.push(m);
		}
	}

	function drawMarks() {
		markGroup.clear();
		const add = (geo, mat, sq, y = 0, scale = 1) => {
			const m = new THREE.Mesh(geo, mat);
			m.position.copy(pos3(sq));
			m.position.y = y;
			m.scale.setScalar(scale);
			m.renderOrder = 2;
			markGroup.add(m);
		};
		for (const sq of state.last ?? []) add(planeGeo, MARK.last, sq);
		for (const [sq, kind] of Object.entries(state.marks ?? {}))
			if (MARK[kind]) add(planeGeo, MARK[kind], sq, 0.001);
		if (selected) add(planeGeo, MARK.sel, selected, 0.002);
		if (hover && hover !== selected) add(planeGeo, MARK.hover, hover, 0.002);
		if (state.check) add(planeGeo, checkMat, state.check, 0.003, 1.25);
		const dests = selected && state.movable?.dests?.get(selected);
		for (const sq of dests ?? [])
			add(
				state.pieces[sq] ? ringGeo : dotGeo,
				state.pieces[sq] ? MARK.ring : MARK.dot,
				sq,
				0.004,
			);
		arrowGroup.clear();
		for (const a of state.arrows ?? []) {
			const p1 = pos3(a.from);
			const p2 = pos3(a.to);
			const dir = new THREE.Vector2(p2.x - p1.x, p2.z - p1.z);
			const len = dir.length();
			const shape = new THREE.Shape();
			const w = 0.09;
			const head = 0.32;
			const body = Math.max(0.05, len - head - 0.2);
			shape.moveTo(0, -w);
			shape.lineTo(body, -w);
			shape.lineTo(body, -w * 2.6);
			shape.lineTo(body + head, 0);
			shape.lineTo(body, w * 2.6);
			shape.lineTo(body, w);
			shape.lineTo(0, w);
			const g = new THREE.ShapeGeometry(shape);
			g.rotateX(-Math.PI / 2);
			const mesh = new THREE.Mesh(
				g,
				flat(ARROW[a.kind ?? ""] ?? ARROW[""], 0.78),
			);
			mesh.position.set(p1.x, 0, p1.z);
			mesh.rotation.y = -Math.atan2(dir.y, dir.x);
			mesh.renderOrder = 3;
			arrowGroup.add(mesh);
		}
		kick();
	}

	/*
	 * One change at a time: a move that arrives while the last one is still gliding waits for it,
	 * so two animations never fight over the same pieces and the board always ends up showing the
	 * latest position.
	 */
	let queue = Promise.resolve();
	function set(next) {
		queue = queue
			.then(() => apply(next))
			.catch((error) => console.error(error));
		return queue;
	}

	async function apply(next) {
		const prev = state.pieces;
		state = { ...state, ...next };
		if (next.pieces) {
			const mv = next.move;
			const jobs = [];
			if (mv && prev[mv.from] && meshes.get(mv.from)) {
				const mesh = meshes.get(mv.from);
				meshes.delete(mv.from);
				const victimSq = mv.ep ?? mv.to;
				const victim = meshes.get(victimSq);
				if (victim) {
					meshes.delete(victimSq);
					sendToTray(victim);
				}
				meshes.set(mv.to, mesh);
				const knight = mesh.userData.code[1] === "n";
				jobs.push(
					glide(mesh, mesh.position, pos3(mv.to), {
						hop: knight ? 0.55 : mv.dropped ? 0 : 0.1,
						ms: mv.dropped ? 120 : knight ? 340 : 280,
					}),
				);
				if (mv.rook && meshes.get(mv.rook[0])) {
					const rook = meshes.get(mv.rook[0]);
					meshes.delete(mv.rook[0]);
					meshes.set(mv.rook[1], rook);
					jobs.push(
						glide(rook, rook.position, pos3(mv.rook[1]), { hop: 0.3, ms: 340 }),
					);
				}
			}
			await Promise.all(jobs);
			// make what stands match what should stand (promotions, undo, new games)
			for (const [sq, mesh] of [...meshes])
				if (next.pieces[sq] !== mesh.userData.code) {
					pieceGroup.remove(mesh);
					meshes.delete(sq);
				}
			for (const [sq, code] of Object.entries(next.pieces))
				if (!meshes.has(sq)) {
					const m = makePiece(code);
					m.position.copy(pos3(sq));
					meshes.set(sq, m);
				}
			if (!mv || !next.move) layoutTray(next.pieces);
			if (!("selected" in next)) selected = null;
		}
		if (next.movable === null) selected = null;
		drawMarks();
	}

	// --- input: pick a piece, drag or click a square --------------------------------------------
	const ray = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const hit = new THREE.Vector3();

	function aim(e) {
		const r = renderer.domElement.getBoundingClientRect();
		ndc.set(
			((e.clientX - r.left) / r.width) * 2 - 1,
			-((e.clientY - r.top) / r.height) * 2 + 1,
		);
		ray.setFromCamera(ndc, camera);
	}
	const squareOf = (x, z) => {
		const f = Math.floor(x + 4);
		const r = Math.floor(4 - z);
		if (f < 0 || f > 7 || r < 0 || r > 7) return null;
		return FILES[f] + (r + 1);
	};
	function pick(e) {
		aim(e);
		const hits = ray.intersectObjects([...meshes.values()], false);
		if (hits.length) {
			for (const [sq, m] of meshes) if (m === hits[0].object) return sq;
		}
		if (ray.ray.intersectPlane(floor, hit)) return squareOf(hit.x, hit.z);
		return null;
	}
	function floorSquare(e) {
		aim(e);
		if (ray.ray.intersectPlane(floor, hit)) return squareOf(hit.x, hit.z);
		return null;
	}

	const canMove = (sq) => {
		const m = state.movable;
		return Boolean(
			m && state.pieces[sq]?.[0] === m.colour && m.dests?.get(sq)?.length,
		);
	};
	const isDest = (sq) =>
		Boolean(selected && state.movable?.dests?.get(selected)?.includes(sq));

	let drag = null;
	const canvas = renderer.domElement;
	canvas.addEventListener("contextmenu", (e) => e.preventDefault());
	canvas.addEventListener("pointerdown", (e) => {
		if (e.button !== 0 || (e.pointerType === "touch" && !e.isPrimary)) return;
		const sq = pick(e);
		if (!sq) return;
		// a piece of the other side standing on a target square is a capture, not a selection
		if (selected && isDest(sq)) {
			const from = selected;
			selected = null;
			drawMarks();
			onMove?.({ from, to: sq });
			return;
		}
		const floorSq = floorSquare(e);
		if (selected && floorSq && isDest(floorSq)) {
			const from = selected;
			selected = null;
			drawMarks();
			onMove?.({ from, to: floorSq });
			return;
		}
		if (canMove(sq)) {
			const again = selected === sq;
			selected = sq;
			onSelect?.(sq);
			drawMarks();
			drag = {
				sq,
				mesh: meshes.get(sq),
				again,
				x: e.clientX,
				y: e.clientY,
				moved: false,
				id: e.pointerId,
			};
			canvas.setPointerCapture(e.pointerId);
			return;
		}
		selected = null;
		onSelect?.(null);
		drawMarks();
	});
	canvas.addEventListener("pointermove", (e) => {
		if (drag && e.pointerId === drag.id) {
			if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5)
				return;
			drag.moved = true;
			aim(e);
			if (
				ray.ray.intersectPlane(
					new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35),
					hit,
				)
			) {
				drag.mesh.position.set(
					Math.max(-4.3, Math.min(4.3, hit.x)),
					0.35,
					Math.max(-4.3, Math.min(4.3, hit.z)),
				);
			}
			const over = floorSquare(e);
			const next = over && isDest(over) ? over : null;
			if (next !== hover) {
				hover = next;
				drawMarks();
			}
			kick();
			return;
		}
		if (e.pointerType === "mouse") {
			const sq = pick(e);
			canvas.style.cursor =
				sq && (canMove(sq) || isDest(sq)) ? "pointer" : "default";
		}
	});
	const endDrag = (e) => {
		if (!drag) return;
		const d = drag;
		drag = null;
		hover = null;
		if (!d.moved) {
			if (d.again) {
				selected = null;
				onSelect?.(null);
			}
			drawMarks();
			return;
		}
		const to = e ? floorSquare(e) : null;
		if (to && to !== d.sq && isDest(to)) {
			selected = null;
			drawMarks();
			onMove?.({ from: d.sq, to, dropped: true });
		} else {
			glide(d.mesh, d.mesh.position, pos3(d.sq), { hop: 0, ms: 160 });
			drawMarks();
		}
	};
	canvas.addEventListener("pointerup", endDrag);
	canvas.addEventListener("pointercancel", () => endDrag(null));

	// --- the view ---------------------------------------------------------------------------------
	let viewDistance = 13;
	function homeCamera() {
		const side = orient === "w" ? 1 : -1;
		const polar = 0.74;
		return new THREE.Vector3(
			0,
			Math.cos(polar) * viewDistance,
			Math.sin(polar) * viewDistance * side,
		);
	}
	function fit() {
		const w = el.clientWidth || 1;
		const h = el.clientHeight || 1;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		// far enough that the whole board (and the captured pieces) fits the narrower side
		const need = TOTAL + 0.4;
		const vfov = (camera.fov * Math.PI) / 180;
		const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
		const byH = need / 2 / Math.tan(vfov / 2);
		const byW = (need + 2.2) / 2 / Math.tan(hfov / 2);
		viewDistance = Math.max(byH * 0.98, byW) + 0.6;
		controls.maxDistance = viewDistance * 1.8;
		controls.minDistance = Math.min(viewDistance * 0.6, 9);
		camera.updateProjectionMatrix();
	}
	function resetView(animated = true) {
		const target = homeCamera();
		if (!animated) {
			camera.position.copy(target);
			camera.lookAt(0, 0, 0);
			controls.update();
			kick();
			return;
		}
		// swing round the board rather than through it
		const from = new THREE.Spherical().setFromVector3(camera.position);
		const to = new THREE.Spherical().setFromVector3(target);
		let dTheta = to.theta - from.theta;
		while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
		while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
		tween(
			650,
			(t) => {
				const e = ease(t);
				const s = new THREE.Spherical(
					from.radius + (to.radius - from.radius) * e,
					from.phi + (to.phi - from.phi) * e,
					from.theta + dTheta * e,
				);
				camera.position.setFromSpherical(s);
				camera.lookAt(0, 0, 0);
			},
			() => controls.update(),
		);
	}

	const ro = new ResizeObserver(() => {
		const before = viewDistance;
		fit();
		// keep the view as it was, only nearer or further
		const len = camera.position.length();
		if (len > 0) camera.position.multiplyScalar(viewDistance / before);
		controls.update();
		kick();
	});
	ro.observe(el);
	fit();
	resetView(false);

	function backdrop(isDark) {
		const c = document.createElement("canvas");
		c.width = 16;
		c.height = 512;
		const g = c.getContext("2d");
		const grd = g.createLinearGradient(0, 0, 0, 512);
		if (isDark) {
			grd.addColorStop(0, "#050404");
			grd.addColorStop(0.55, "#16110e");
			grd.addColorStop(1, "#1f1813");
		} else {
			grd.addColorStop(0, "#cfc6b8");
			grd.addColorStop(0.55, "#ebe4d8");
			grd.addColorStop(1, "#d8cfc0");
		}
		g.fillStyle = grd;
		g.fillRect(0, 0, 16, 512);
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		return t;
	}
	function setTheme(isDark) {
		scene.background?.dispose?.();
		scene.background = backdrop(isDark);
		scene.fog = new THREE.Fog(isDark ? 0x17120f : 0xddd5c8, 22, 48);
		tableMat.color.set(isDark ? 0x261d17 : 0xa8987f);
		hemi.intensity = isDark ? 0.22 : 0.42;
		key.intensity = isDark ? 380 : 300;
		rim.intensity = isDark ? 0.7 : 0.45;
		scene.environmentIntensity = isDark ? 0.4 : 0.55;
		renderer.toneMappingExposure = isDark ? 0.95 : 0.92;
		kick();
	}
	setTheme(dark);

	// --- render only while something moves -------------------------------------------------------
	controls.addEventListener("change", () => kick());
	function frameLoop(now) {
		raf = 0;
		if (!alive) return;
		for (let i = tweens.length - 1; i >= 0; i--) {
			const tw = tweens[i];
			const t = Math.min(1, (now - tw.start) / tw.duration);
			tw.step(t);
			if (t >= 1) {
				tweens.splice(i, 1);
				tw.done?.();
			}
		}
		const moving = controls.update();
		renderer.render(scene, camera);
		if (tweens.length || moving || drag) kick();
	}
	function kick() {
		if (!raf && alive) raf = requestAnimationFrame(frameLoop);
	}
	kick();

	return {
		el,
		kind: "3d",
		set,
		get orientation() {
			return orient;
		},
		orient(o) {
			if (o === orient) return;
			orient = o;
			resetView(true);
		},
		select(sq) {
			selected = sq;
			drawMarks();
		},
		rectOf(sq) {
			const p = pos3(sq);
			p.y = 0.4;
			p.project(camera);
			const r = renderer.domElement.getBoundingClientRect();
			const x = ((p.x + 1) / 2) * r.width + r.left;
			const y = ((1 - p.y) / 2) * r.height + r.top;
			const size = Math.max(36, r.width / 12);
			return {
				left: x - size / 2,
				top: y - size / 2,
				width: size,
				height: size,
			};
		},
		setTheme,
		resetView: () => resetView(true),
		resize: () => {
			fit();
			kick();
		},
		/** Look from a point at a point (a still picture: the listing's banner). */
		lookFrom(position, target = [0, 0, 0]) {
			controls.target.set(...target);
			camera.position.set(...position);
			camera.lookAt(...target);
			controls.update();
			kick();
		},
		/** A picture of the board as it is now (for sharing and the listing). */
		snapshot() {
			renderer.render(scene, camera);
			return renderer.domElement.toDataURL("image/png");
		},
		destroy() {
			alive = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			controls.dispose();
			renderer.dispose();
			pmrem.dispose();
			el.remove();
		},
	};
}
