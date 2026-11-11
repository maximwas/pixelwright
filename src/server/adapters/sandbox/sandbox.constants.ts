export const SANDBOX_TEXT = {
  busy: (ms: number) => `The code ran ${ms / 1_000} s without a pause and was stopped: an endless loop?`,
  thrown: (name: string, message: string) => `${name}: ${message}`,
  at: (line: number, column: number) => `    at line ${line}, column ${column}`,
  quoted: (line: number, text: string) => `line ${line}: ${text}`,
  /** What JSON cannot hold (a function, a symbol) as the code's value: JSON.stringify gives undefined for it. */
  notData: "The result is not data (a function?): return objects, arrays, strings, numbers, booleans or null.",
  /** The longest line of the code an error quotes. */
  quotedChars: 200,
  lineBreak: "\n",
  errorName: "Error",
} as const;

/**
 * How a run is laid out in QuickJS. Each pw answer is wrapped by its shape (a Proxy): a key its type does not know
 * throws `pw.<name>: no field "<key>" here; fields: …`, a known key it lacks reads undefined; symbols, then, toJSON,
 * length, array indexes and what the prototype has pass, so JSON.stringify, spreads and array methods work as on plain
 * data. The prelude is a function of the host's functions and of the utils' script (a
 * function of pw, data/pw-utils.json): it gives the code `pw`, `utils` and `console` and returns the starter, so no host
 * function ever sits on the global object. The code is the body of an
 * async function from the second line of its file; its value goes out as JSON (undefined as null).
 */
export const SANDBOX_SCRIPT = {
  fileName: "execute.js",
  preludeName: "prelude.js",
  utilsName: "utils.js",
  /** Where a QuickJS stack names a place in the code's file: line and column. */
  place: /execute\.js:(\d+):(\d+)/,
  linesBefore: 1,
  wrapped: (code: string) => `(async () => {\n${code}\n})`,
  prelude: `(function (call, log, done, failed, names, shapesText, guestUtils) {
  const text = (value) => typeof value === "string" ? value : value instanceof Error ? value.name + ": " + value.message : String(JSON.stringify(value));
  const line = (...values) => log(values.map(text).join(" "));
  globalThis.console = Object.freeze({ log: line, info: line, warn: line, error: line, debug: line });
  const shapes = JSON.parse(shapesText);
  const passing = ["then", "toJSON", "length"];
  const wrap = (name, value, shape) => {
    if (typeof value !== "object" || value === null || shape === undefined) return value;
    const array = Array.isArray(value);
    return new Proxy(value, { get(target, key, receiver) {
      const child = Reflect.get(target, key, receiver);
      if (typeof key === "symbol" || passing.includes(key)) return child;
      if (Object.hasOwn(target, key)) return wrap(name, child, array ? shape.items : (shape.fields?.[key] ?? shape.values));
      if (array || key in target || shape.keys === undefined || shape.keys.includes(key)) return child;
      throw new Error("pw." + name + ": no field " + JSON.stringify(key) + " here; fields: " + shape.keys.join(", "));
    } });
  };
  globalThis.pw = Object.freeze(Object.fromEntries(JSON.parse(names).map((name) => [name, async (args) => wrap(name, JSON.parse(await call(name, JSON.stringify(args === undefined ? {} : args))), shapes[name])])));
  globalThis.utils = Object.freeze(guestUtils(globalThis.pw));
  const json = (value) => { const text = JSON.stringify(value === undefined ? null : value); if (text === undefined) throw new TypeError(${JSON.stringify(SANDBOX_TEXT.notData)}); return text; };
  return (body) => body().then((value) => done(json(value))).catch((error) => failed(error));
})`,
  /** The host functions' names inside QuickJS, as its stacks would show them. */
  call: "call",
  log: "log",
  done: "done",
  failed: "failed",
} as const;
