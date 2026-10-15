/*
 * MATHS THE WAY PEOPLE TYPE IT: a small, safe expression language (no eval) for graphs and for
 * checking answers. It reads 2x, 3(x+1), (x+1)(x-1), x², √x, 2π, sin x, 5!, 1,5 (a decimal comma when
 * nothing else needs the comma), · × ÷ and −. compile() turns an expression into a fast function of
 * named values; equivalent() decides whether two answers are the same expression by trying them at
 * many points, so "2(x+1)" and "2x+2" both count.
 */

const FUNCS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (x) => 1 / Math.tan(x),
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  lg: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  sgn: Math.sign,
  min: Math.min,
  max: Math.max,
  tg: Math.tan,
  ctg: (x) => 1 / Math.tan(x),
};
const CONSTS = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI };

function factorial(n) {
  if (n < 0 || !Number.isFinite(n)) return Number.NaN;
  if (!Number.isInteger(n)) return gamma(n + 1);
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function gamma(z) {
  // Lanczos approximation
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
}

/** Tidy the typed text: unicode operators, superscripts, a decimal comma. */
export function tidy(src) {
  let s = String(src ?? "")
    .trim()
    .replace(/[−–]/g, "-")
    .replace(/[·×∙⋅]/g, "*")
    .replace(/÷|:/g, "/")
    .replace(/\*\*/g, "^")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√/g, "sqrt ")
    .replace(/\s+/g, " ");
  // 1,5 is a decimal comma unless commas separate function arguments
  if (!/\(\s*[^()]*,/.test(s)) s = s.replace(/(\d),(\d)/g, "$1.$2");
  return s;
}

function tokenize(src) {
  const s = tidy(src);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) {
      out.push({ t: "num", v: Number.parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-zα-ωπ_][A-Za-z0-9_α-ω]*/.exec(s.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    if ("+-*/^(),!|".includes(c)) {
      out.push({ t: c });
      i++;
      continue;
    }
    if (c === "[" || c === "{") {
      out.push({ t: "(" });
      i++;
      continue;
    }
    if (c === "]" || c === "}") {
      out.push({ t: ")" });
      i++;
      continue;
    }
    throw new Error(`I cannot read "${c}"`);
  }
  return out;
}

/** Split a run of letters like "xy" or "2pix" into known names (variables first, then functions). */
function splitName(name, known) {
  if (known.has(name) || FUNCS[name] || name in CONSTS) return [name];
  const parts = [];
  let rest = name;
  while (rest) {
    let hit = "";
    for (const k of [...known, ...Object.keys(FUNCS), ...Object.keys(CONSTS)])
      if (rest.startsWith(k) && k.length > hit.length) hit = k;
    if (!hit) return [name];
    parts.push(hit);
    rest = rest.slice(hit.length);
  }
  return parts;
}

/** Parse to a tree. `names`: the variable and parameter names that may appear. */
export function parse(src, names = ["x"]) {
  const known = new Set(names);
  const raw = tokenize(src);
  const toks = [];
  for (const t of raw)
    if (t.t === "id")
      for (const p of splitName(t.v, known)) toks.push({ t: "id", v: p });
    else toks.push(t);
  let pos = 0;
  const peek = () => toks[pos];
  const take = (t) => {
    if (peek()?.t !== t) throw new Error(`Expected "${t}"`);
    pos++;
  };
  const startsPrimary = (tk) =>
    tk && (tk.t === "num" || tk.t === "id" || tk.t === "(" || tk.t === "|");

  function expr() {
    let left = term();
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = toks[pos++].t;
      left = { op, a: left, b: term() };
    }
    return left;
  }
  function term() {
    let left = unary();
    for (;;) {
      const tk = peek();
      if (tk && (tk.t === "*" || tk.t === "/")) {
        pos++;
        left = { op: tk.t, a: left, b: unary() };
      } else if (startsPrimary(tk) && !(tk.t === "|" && inAbs > 0)) {
        // implicit multiplication: 2x, 3(x+1), x sin x
        left = { op: "*", a: left, b: power() };
      } else return left;
    }
  }
  function unary() {
    if (peek()?.t === "-") {
      pos++;
      return { op: "neg", a: unary() };
    }
    if (peek()?.t === "+") {
      pos++;
      return unary();
    }
    return power();
  }
  function power() {
    const base = postfix();
    if (peek()?.t === "^") {
      pos++;
      return { op: "^", a: base, b: unary() };
    }
    return base;
  }
  function postfix() {
    let v = primary();
    while (peek()?.t === "!") {
      pos++;
      v = { op: "!", a: v };
    }
    return v;
  }
  let inAbs = 0;
  function primary() {
    const tk = toks[pos++];
    if (!tk) throw new Error("The expression ends too soon");
    if (tk.t === "num") return { num: tk.v };
    if (tk.t === "(") {
      const v = expr();
      take(")");
      return v;
    }
    if (tk.t === "|") {
      inAbs++;
      const v = expr();
      inAbs--;
      take("|");
      return { fn: "abs", args: [v] };
    }
    if (tk.t === "id") {
      const name = tk.v;
      if (FUNCS[name]) {
        // sin^2 x
        let powerOf = null;
        if (peek()?.t === "^") {
          pos++;
          powerOf = postfix();
        }
        let args;
        if (peek()?.t === "(") {
          pos++;
          args = [expr()];
          while (peek()?.t === ",") {
            pos++;
            args.push(expr());
          }
          take(")");
        } else args = [power()]; // sin x
        const call = { fn: name, args };
        return powerOf ? { op: "^", a: call, b: powerOf } : call;
      }
      if (name in CONSTS && !known.has(name)) return { num: CONSTS[name] };
      return { v: name };
    }
    throw new Error(`Unexpected "${tk.t}"`);
  }
  const tree = expr();
  if (pos < toks.length) throw new Error(`Unexpected "${toks[pos].t}"`);
  return tree;
}

function build(n) {
  if ("num" in n) {
    const v = n.num;
    return () => v;
  }
  if (n.v) {
    const k = n.v;
    return (s) => (k in s ? s[k] : Number.NaN);
  }
  if (n.fn) {
    const f = FUNCS[n.fn];
    const args = n.args.map(build);
    if (args.length === 1) {
      const a = args[0];
      return (s) => f(a(s));
    }
    return (s) => f(...args.map((g) => g(s)));
  }
  const a = build(n.a);
  const b = n.b ? build(n.b) : null;
  switch (n.op) {
    case "+":
      return (s) => a(s) + b(s);
    case "-":
      return (s) => a(s) - b(s);
    case "*":
      return (s) => a(s) * b(s);
    case "/":
      return (s) => a(s) / b(s);
    case "^":
      return (s) => {
        const x = a(s);
        const y = b(s);
        // odd roots of negatives: (-8)^(1/3) = -2
        if (x < 0 && !Number.isInteger(y)) {
          const inv = 1 / y;
          if (
            Number.isInteger(Math.round(inv)) &&
            Math.abs(inv - Math.round(inv)) < 1e-9 &&
            Math.round(inv) % 2
          )
            return -((-x) ** y);
        }
        return x ** y;
      };
    case "neg":
      return (s) => -a(s);
    case "!":
      return (s) => factorial(a(s));
  }
  throw new Error("Unknown operation");
}

/** compile("a*sin(x)", ["x","a"]) -> (scope) => number */
export function compile(src, names = ["x"]) {
  return build(parse(src, names));
}

/** The free names an expression uses (to know which sliders a graph needs). */
export function namesIn(src) {
  const out = new Set();
  const walk = (n) => {
    if (!n) return;
    if (n.v) out.add(n.v);
    if (n.args) n.args.forEach(walk);
    walk(n.a);
    walk(n.b);
  };
  walk(parse(src, []));
  return [...out];
}

/** Evaluate once: evaluate("2^10") -> 1024. */
export function evaluate(src, scope = {}) {
  return compile(src, Object.keys(scope))(scope);
}

const close = (a, b, rel = 1e-6) =>
  (Number.isNaN(a) && Number.isNaN(b)) ||
  a === b ||
  Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Are two expressions the same? Tries them at many points for the given variables; points where
 * either is undefined are skipped, and there must be enough points where both are defined.
 */
export function equivalent(a, b, vars = ["x"], { tolerance = 1e-6 } = {}) {
  let fa;
  let fb;
  try {
    fa = compile(a, vars);
    fb = compile(b, vars);
  } catch {
    return false;
  }
  let checked = 0;
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 60 && checked < 24; i++) {
    const s = {};
    for (const v of vars) s[v] = (rnd() - 0.5) * (i < 30 ? 6 : 40);
    const x = fa(s);
    const y = fb(s);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (Number.isFinite(x) !== Number.isFinite(y) && i > 40) return false;
      continue;
    }
    if (!close(x, y, tolerance)) return false;
    checked++;
  }
  return checked >= 6;
}

const isSum = (n) => n && (n.op === "+" || n.op === "-");
function containsSum(n) {
  if (!n) return false;
  if (isSum(n)) return true;
  return (
    containsSum(n.a) || containsSum(n.b) || (n.args || []).some(containsSum)
  );
}

/**
 * Is the answer written in the asked form? "factored": a product (or power) with a bracketed sum in
 * it, like (x-1)(x-3) or 2(x+1)^2; "expanded": no bracket of a sum multiplied or raised, like
 * x^2-4x+3. Equivalence alone would accept either, which is not what "factor it" asks.
 */
export function hasForm(src, form, vars = ["x"]) {
  let t;
  try {
    t = parse(src, vars);
  } catch {
    return false;
  }
  while (t.op === "neg") t = t.a;
  if (form === "factored") {
    if (t.op === "^") return isSum(t.a);
    if (t.op !== "*") return false;
    const factors = [];
    const walk = (n) => {
      if (n.op === "*") {
        walk(n.a);
        walk(n.b);
      } else factors.push(n);
    };
    walk(t);
    return factors.some((f) => isSum(f) || (f.op === "^" && isSum(f.a)));
  }
  if (form === "expanded") {
    const bad = (n) => {
      if (!n) return false;
      if (n.op === "*" && (containsSum(n.a) || containsSum(n.b))) return true;
      if (n.op === "^" && containsSum(n.a)) return true;
      return bad(n.a) || bad(n.b) || (n.args || []).some(bad);
    };
    return !bad(t);
  }
  return true;
}

/**
 * Check a typed answer against the expected one.
 * kind: "number" (with tolerance, absolute or "2%"), "expr" (equivalent expressions in `vars`),
 * "text" (case and accent-insensitive, any of several accepted answers), "choice" (index or indices).
 */
export function checkAnswer(
  given,
  expected,
  { kind = "number", tolerance = 0, vars = ["x"], form = null } = {},
) {
  if (given === null || given === undefined || String(given).trim() === "")
    return false;
  if (kind === "number") {
    const list = [].concat(expected);
    let g;
    try {
      g = evaluate(String(given));
    } catch {
      return false;
    }
    return list.some((e) => {
      const want = typeof e === "number" ? e : evaluate(String(e));
      if (typeof tolerance === "string" && tolerance.endsWith("%"))
        return (
          Math.abs(g - want) <=
          (Math.abs(want) * Number.parseFloat(tolerance)) / 100
        );
      return (
        Math.abs(g - want) <=
        (Number(tolerance) || 1e-9 * Math.max(1, Math.abs(want)))
      );
    });
  }
  if (kind === "expr") {
    const g = String(given)
      .replace(/^[a-z]\s*\(?x?\)?\s*=/i, "")
      .replace(/^y\s*=/i, "");
    if (form && !hasForm(g, form, vars)) return false;
    return [].concat(expected).some((e) => equivalent(g, String(e), vars));
  }
  if (kind === "choice") {
    const want = [].concat(expected).map(Number).sort();
    const got = [].concat(given).map(Number).sort();
    return want.length === got.length && want.every((v, i) => v === got[i]);
  }
  const norm = (t) =>
    String(t)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "dj")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return [].concat(expected).some((e) => norm(e) === norm(given));
}
