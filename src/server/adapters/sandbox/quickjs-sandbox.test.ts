import { describe, expect, it } from "vitest";
import type { SandboxRun } from "@/core/ports/code-sandbox.port.ts";
import { QuickJsSandbox } from "@/server/adapters/sandbox/quickjs-sandbox.ts";

const LIMITS = { memoryBytes: 16 * 1024 * 1024, stackBytes: 256 * 1024, cpuSliceMs: 300, logChars: 4_000 };

async function echo(name: string, args: unknown): Promise<unknown> {
  return { name, args };
}

function run(code: string, overrides: Partial<SandboxRun> = {}) {
  return new QuickJsSandbox().run({
    code,
    names: ["echo", "fail", "wait"],
    shapes: {},
    call: echo,
    limits: LIMITS,
    stop: new Promise<string>(() => undefined),
    ...overrides,
  });
}

describe("QuickJsSandbox", () => {
  it("runs the code as the body of an async function: pw calls in parallel, their values back, console lines kept", async () => {
    const answer = await run(
      'console.log("rows", { count: 2 });\nconst [one, two] = await Promise.all([pw.echo({ n: 1 }), pw.echo()]);\nreturn { one, two };',
    );

    expect(answer).toEqual({
      result: { one: { name: "echo", args: { n: 1 } }, two: { name: "echo", args: {} } },
      logs: ['rows {"count":2}'],
    });
  });

  it("gives the code a failed call as an Error it can catch, and tells an uncaught error with its line", async () => {
    async function call(name: string): Promise<unknown> {
      if (name === "fail") {
        throw new Error("pw.fail: no layer 1:2");
      }

      return {};
    }

    expect((await run("try { await pw.fail({}); } catch (error) { return error.message; }", { call })).result).toBe(
      "pw.fail: no layer 1:2",
    );
    expect((await run("const a = 1;\nnull.x;\nreturn a;")).error).toMatch(
      /^TypeError: .+\n {4}at line 2, column \d+\nline 2: null\.x;$/,
    );
  });

  it("answers a syntax error with the code's own line and column, the line quoted", async () => {
    expect((await run("const a = 1;\nconst b = ;\nreturn a;")).error).toMatch(
      /^SyntaxError: .+\n {4}at line 2, column \d+\nline 2: const b = ;$/,
    );
  });

  it("stops code that keeps the CPU busy past its slice without a pause, and the next run works", async () => {
    expect((await run("while (true) {}")).error).toBe(
      "The code ran 0.3 s without a pause and was stopped: an endless loop?",
    );
    expect((await run("return 1;")).result).toBe(1);
  });

  it("stops code past its memory and a recursion past its stack, the server's own stack untouched", async () => {
    expect(
      (
        await run("const blocks = [];\nfor (;;) blocks.push(new Uint8Array(1 << 20));", {
          limits: { ...LIMITS, cpuSliceMs: 5_000 },
        })
      ).error,
    ).toMatch(/^InternalError: out of memory/);
    expect((await run("function deeper(n) { return deeper(n + 1) + 1; }\nreturn deeper(0);")).error).toMatch(
      /^RangeError: Maximum call stack size exceeded/,
    );
  });

  it("ends at once when it is stopped, with the stop's reason, a pending call left behind", async () => {
    let stop: (reason: string) => void = () => undefined;
    const pending = run("await pw.wait({});\nreturn 1;", {
      call: () => new Promise(() => undefined),
      stop: new Promise((resolve) => {
        stop = resolve;
      }),
    });

    setTimeout(() => stop("The run was cancelled."), 20);

    expect(await pending).toEqual({ result: null, logs: [], error: "The run was cancelled." });
  });

  // A log line is copied out of QuickJS into the server's memory, outside its limit: kept unbounded, a loop logging
  // 1 MB lines held gigabytes within one CPU slice.
  it("keeps only the last logged characters while the code runs, a too-long line by its end, and counts the lines it left out", async () => {
    const answer = await run(
      'const line = "x".repeat(1_000);\nfor (let i = 0; i < 100; i += 1) console.log(i + ":" + line);\nconsole.log("y".repeat(5_000) + "END");\nreturn 1;',
    );

    expect(answer.result).toBe(1);
    expect(answer.logs).toEqual(["y".repeat(3_997) + "END"]);
    expect(answer.earlierLines).toBe(100);
  });

  // quickjs-ng 0.32.0: a stack overflow inside JSON.stringify leaves objects alive, freeing the runtime aborts the WASM
  // module, and the shared module failed every run after.
  it("answers the run's own error when QuickJS cannot free its runtime, and the next run works", async () => {
    const sandbox = new QuickJsSandbox();
    const deep = await sandbox.run({
      code: "const a = [];\nlet x = a;\nfor (let i = 0; i < 10000; i += 1) { const y = []; x.push(y); x = y; }\nreturn a;",
      names: [],
      shapes: {},
      call: echo,
      limits: LIMITS,
      stop: new Promise<string>(() => undefined),
    });
    const next = await sandbox.run({
      code: "return 1;",
      names: [],
      shapes: {},
      call: echo,
      limits: LIMITS,
      stop: new Promise<string>(() => undefined),
    });

    expect(deep.error).toMatch(/^(RangeError|InternalError): /);
    expect(next).toEqual({ result: 1, logs: [] });
  });

  it("answers a result that is not data in plain words", async () => {
    expect((await run("return () => 1;")).error).toMatch(/^TypeError: The result is not data/);
  });

  it("gives the code utils over pw: layers in inspect batches, map in order, colours, every pw call counted", async () => {
    const calls: string[] = [];

    async function call(name: string, args: unknown): Promise<unknown> {
      const { nodes = [] } = args as { nodes?: string[] };

      calls.push(name);

      if (name === "nodesFind") {
        return {
          nodes: Array.from({ length: 150 }, (_unused, index) => ({ id: `1:${index}`, type: "TEXT", path: [] })),
          more: false,
        };
      }

      return name === "inspect" ? { layers: nodes.map((id) => ({ id, text: { fontSizes: [16] }, fills: {} })) } : args;
    }

    const answer = await run(
      `const { layers, more } = await utils.layers({ type: "TEXT" }, { fields: ["text"] });
const { map } = utils;
const doubled = await map([3, 1, 2], async (n) => (await pw.echo({ n })).n * 2, { limit: 2 });
return { count: layers.length, last: layers[149], more, doubled, red: utils.color("rgb(255 0 0 / 50%)"), frozen: Object.isFrozen(utils) };`,
      { names: ["nodesFind", "inspect", "echo"], call },
    );

    expect(answer.error).toBeUndefined();
    expect(answer.result).toEqual({
      count: 150,
      last: { id: "1:149", type: "TEXT", path: [], text: { fontSizes: [16] } },
      more: false,
      doubled: [6, 2, 4],
      red: { r: 255, g: 0, b: 0, a: 0.5 },
      frozen: true,
    });
    expect(calls.sort()).toEqual(["echo", "echo", "echo", "inspect", "inspect", "nodesFind"]);
  });

  it("gives the code no Node, no network and no timers: only pw and console", async () => {
    const code =
      "return [typeof require, typeof process, typeof fetch, typeof setTimeout, typeof __pwCall, typeof pw.echo];";

    expect((await run(code)).result).toEqual([
      "undefined",
      "undefined",
      "undefined",
      "undefined",
      "undefined",
      "function",
    ]);
  });

  describe("an answer read by the keys its tool's answer type has", () => {
    const shapes = {
      echo: {
        keys: ["name", "args", "more"],
        fields: { args: { keys: ["n", "rows"], fields: { rows: { items: { keys: ["id"] } } } } },
      },
    };

    async function call(): Promise<unknown> {
      return { name: "echo", args: { n: 1, rows: [{ id: "1:2" }] } };
    }

    // Models guessed keys (answer.nodes for layers) and got undefined, then wrong results without an error.
    it("throws on a key the type does not know, naming the fields there are, at the top, nested and in array items", async () => {
      const code = [
        "const answer = await pw.echo();",
        "const read = (get) => { try { get(); return null; } catch (error) { return error.message; } };",
        "return [read(() => answer.nmae), read(() => answer.args.count), read(() => answer.args.rows[0].idd)];",
      ].join("\n");

      expect((await run(code, { shapes, call })).result).toEqual([
        'pw.echo: no field "nmae" here; fields: name, args, more',
        'pw.echo: no field "count" here; fields: n, rows',
        'pw.echo: no field "idd" here; fields: id',
      ]);
    });

    it("reads a key the type knows but this answer lacks as undefined; then, length, indexes and array methods pass", async () => {
      const code =
        "const answer = await pw.echo();\nreturn [answer.more === undefined, typeof answer.then, answer.args.rows.length, answer.args.rows.map(({ id }) => id), answer.hasOwnProperty('name')];";

      expect((await run(code, { shapes, call })).result).toEqual([true, "undefined", 1, ["1:2"], true]);
    });

    // A new Proxy on every read made a.rows[0] === a.rows[0] false, and indexOf, includes and Set stopped working.
    it("gives the same object for the same element, so identity, indexOf, includes and Set work", async () => {
      const code = [
        "const answer = await pw.echo();",
        "const rows = answer.args.rows;",
        "return [rows[0] === rows[0], rows.indexOf(rows[0]), rows.includes(rows[0]), new Set([rows[0], answer.args.rows[0]]).size];",
      ].join("\n");

      expect((await run(code, { shapes, call })).result).toEqual([true, 0, true, 1]);
    });

    it("serialises a wrapped answer as the plain one", async () => {
      const plain = { name: "echo", args: { n: 1, rows: [{ id: "1:2" }] } };

      expect((await run("return JSON.stringify(await pw.echo());", { shapes, call })).result).toBe(
        JSON.stringify(plain),
      );
      expect((await run("return await pw.echo();", { shapes, call })).result).toEqual(plain);
    });
  });
});
