import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { codeFrames } from "../src/operations/execute/code-error.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Ran {
  result: unknown;
  logs: string[];
  error?: string;
}

let fake: ReturnType<typeof installFigma>;
const run = async (code: string, timeoutMs = 1_000) =>
  (await plugin.run("execute", {
    code,
    timeoutMs,
  })) as Ran;

beforeEach(() => {
  fake = installFigma(
    tree({
      id: "0:1",
      type: "PAGE",
      name: "Page 1",
      children: [
        {
          id: "1:1",
          name: "Card",
        },
        {
          id: "1:2",
          type: "TEXT",
          name: "Title",
          characters: "Hi",
        },
      ],
    }),
  );
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("execute", () => {
  it("returns what the code returns, layers as their id, type and name, with what it logged, in one undo step", async () => {
    const ran = await run('console.log("hi", { a: 1 }); return figma.currentPage.children;');

    expect(ran).toEqual({
      result: [
        {
          id: "1:1",
          type: "FRAME",
          name: "Card",
        },
        {
          id: "1:2",
          type: "TEXT",
          name: "Title",
        },
      ],
      logs: ['hi {"a":1}'],
    });
    expect(fake.writes.undo).toBe(1);
  });

  it("makes what JSON cannot carry readable: figma.mixed, repeats, undefined", async () => {
    const { result } = await run(
      'const a = { name: "a" }; a.self = a; return { mixed: figma.mixed, a, nothing: undefined, list: [1, undefined] };',
    );

    expect(result).toEqual({
      mixed: "mixed",
      a: {
        name: "a",
        self: "[circular]",
      },
      list: [1, null],
    });
    expect((await run("figma.currentPage.name;")).result).toBeNull();
  });

  it("returns what the code threw with what it logged before, and still makes one undo step", async () => {
    expect(await run('console.warn("before"); throw new Error("boom");')).toEqual({
      result: null,
      logs: ["warn: before"],
      error: 'Error: boom\n    at line 1, column 31\nline 1: console.warn("before"); throw new Error("boom");',
    });
    expect(fake.writes.undo).toBe(1);
    expect((await run("return (")).error).toMatch(/SyntaxError/);
  });

  it("says where in the code an error came from, the calls that led there and the line itself", async () => {
    const { error } = await run(
      ["const label = (layer) => layer.missing();", "await null;", "return [1].map((each) => label(each));"].join("\n"),
    );

    expect(error).toBe(
      [
        "TypeError: layer.missing is not a function",
        "    at label (line 1, column 32)",
        "    at line 3, column 26",
        "    at line 3, column 12",
        "line 1: const label = (layer) => layer.missing();",
      ].join("\n"),
    );
  });

  it("names the async call when Figma refuses a synchronous one for dynamic-page, unless Figma named it", async () => {
    Object.assign(figma, {
      getNodeById: () => {
        throw new Error("in getNodeById: Cannot call with documentAccess: dynamic-page");
      },
      getLocalPaintStyles: () => {
        throw new Error("Cannot call with documentAccess: dynamic-page. Use getLocalPaintStylesAsync instead.");
      },
    });

    expect((await run('return figma.getNodeById("1:1");')).error).toMatch(
      /\nUse await figma\.getNodeByIdAsync\(id\) instead: this plugin's documentAccess is dynamic-page\.$/,
    );
    expect((await run("return figma.getLocalPaintStyles();")).error).not.toMatch(/\nUse /);
  });

  it("gives figma.skipInvisibleInstanceChildren back as the plugin had it, whatever the code set", async () => {
    Object.assign(figma, { skipInvisibleInstanceChildren: true });
    await run("figma.skipInvisibleInstanceChildren = false; return 1;");

    expect(figma.skipInvisibleInstanceChildren).toBe(true);
  });

  it("stops waiting at its timeout and says the code may still be running", async () => {
    const { error } = await run("await new Promise(() => {});", 50);

    expect(error).toMatch(/50 ms/);
    expect(error).toMatch(/may still/);
  });

  it("keeps the first logs and counts the rest", async () => {
    const { logs } = await run("for (let i = 0; i < 300; i++) console.log(i);");

    expect(logs).toHaveLength(201);
    expect(logs[0]).toBe("0");
    expect(logs[200]).toMatch(/100 more/);
  });

  it("returns plain data with an id and a type as the code built it, only Figma's own layers as their summary", async () => {
    const { result } = await run(
      "return figma.currentPage.children.map((node) => ({ id: node.id, type: node.type, name: node.name, width: 100 }));",
    );

    expect(result).toEqual([
      {
        id: "1:1",
        type: "FRAME",
        name: "Card",
        width: 100,
      },
      {
        id: "1:2",
        type: "TEXT",
        name: "Title",
        width: 100,
      },
    ]);
  });

  it("puts back the window's message handler the code replaced, so Allow edits still reaches the plugin", async () => {
    const handler = () => undefined;

    Object.assign(figma, { ui: { onmessage: handler } });
    await run("figma.ui.onmessage = () => {}; return 1;");

    expect((figma as unknown as { ui: { onmessage: unknown } }).ui.onmessage).toBe(handler);
  });

  it("refuses to run while Allow edits is off", async () => {
    plugin.services.edits.allow(false);

    await expect(run("return 1;")).rejects.toMatchObject({ code: "EDITS_DISABLED" });
  });
});

describe("execute: pw, kept between calls", () => {
  it("keeps pw.state and the code's own helpers from one call to the next", async () => {
    await run("pw.state.count = 1; pw.double = (value) => value * 2;");

    expect((await run("pw.state.count += 1; return [pw.state.count, pw.double(21)];")).result).toEqual([2, 42]);
  });

  it("finds a layer by id with pw.node, or says it is not there", async () => {
    expect((await run('return (await pw.node("1:2")).name;')).result).toBe("Title");
    expect((await run('await pw.node("9:9");')).error).toMatch(/No layer 9:9/);
  });

  it("loads every font the texts under a layer use with pw.fonts", async () => {
    fake = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "1:1",
            name: "Card",
            children: [
              {
                id: "1:2",
                type: "TEXT",
                characters: "Plan",
                fontName: {
                  family: "Space Grotesk",
                  style: "Bold",
                },
              },
              {
                id: "1:3",
                type: "TEXT",
                characters: "",
                fontName: {
                  family: "Inter",
                  style: "Regular",
                },
              },
            ],
          },
        ],
      }),
    );

    expect((await run('return await pw.fonts(await pw.node("1:1"));')).result).toEqual([
      "Space Grotesk Bold",
      "Inter Regular",
    ]);
    expect([...fake.writes.loaded]).toEqual(expect.arrayContaining(["Space Grotesk Bold", "Inter Regular"]));
  });

  it("turns a CSS colour into a Figma paint with pw.paint, its alpha as the opacity", async () => {
    expect((await run('return pw.paint("rgba(255, 0, 0, 0.5)");')).result).toEqual({
      type: "SOLID",
      color: {
        r: 1,
        g: 0,
        b: 0,
      },
      opacity: 0.5,
    });
    expect((await run('pw.paint("not a colour");')).error).toMatch(/not a CSS colour/);
  });

  it("finds a variable by the CSS name design_read gives it with pw.variable", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [],
      }),
      {
        localCollections: [
          {
            id: "C:1",
            name: "Theme",
            remote: false,
            defaultModeId: "M:1",
            modes: [
              {
                modeId: "M:1",
                name: "Light",
              },
            ],
          },
        ],
        localVariables: [
          {
            id: "V:brand",
            name: "color/brand",
            variableCollectionId: "C:1",
            resolvedType: "COLOR",
            scopes: ["ALL_SCOPES"],
            codeSyntax: {},
            valuesByMode: {
              "M:1": {
                r: 0.231,
                g: 0.184,
                b: 0.851,
                a: 1,
              },
            },
          },
        ],
      },
    );

    expect((await run('return (await pw.variable("--color-brand")).id;')).result).toBe("V:brand");
  });
});

describe("execute that changes nothing", () => {
  /** A plugin as it runs in Figma: its change journal watching the page from the start. */
  const watched = testPlugin({ allowEdits: true });
  const runWatched = async (code: string) =>
    (await watched.run("execute", {
      code,
      timeoutMs: 1_000,
    })) as Ran & { note?: string };

  beforeEach(() => {
    watched.services.journal.start();
  });

  it("says when the code changed no layer that the read tools read without code, with Allow edits off", async () => {
    const ran = await runWatched("return figma.currentPage.children.length;");

    expect(ran.result).toBe(2);
    expect(ran.note).toMatch(/changed no layer/);
    expect(ran.note).toMatch(/design_read, inspect, measure and nodes_find/);
    expect(ran.note).toMatch(/Allow edits is off/);
  });

  it("gives no note when Figma reports the code's change a moment after the code returns", async () => {
    const [card] = fake.figma.currentPage.children ?? [];

    // Figma reports changes in batches, after the code that made them: here 30 ms after the call starts.
    setTimeout(
      () =>
        fake.emit(
          "nodechange",
          {
            nodeChanges: [
              {
                id: "1:1",
                node: card,
                type: "PROPERTY_CHANGE",
                origin: "LOCAL",
                properties: ["name"],
              },
            ],
          },
          "0:1",
        ),
      30,
    );

    const ran = await runWatched('(await figma.getNodeByIdAsync("1:1")).name = "Card 2";');

    expect(ran.error).toBeUndefined();
    expect(ran).not.toHaveProperty("note");
  });

  it("gives no note when the code threw, whatever it changed", async () => {
    const ran = await runWatched('throw new Error("not this time");');

    expect(ran.error).toMatch(/not this time/);
    expect(ran).not.toHaveProperty("note");
  });
});

describe("execute errors in Figma's QuickJS (live check)", () => {
  it("keeps the engine's columns, as QuickJS points at another token of the probe than V8", () => {
    // `throw new Error();` as Figma's QuickJS reports it: the body from line 3, the column at the call's `(`.
    const probe = {
      name: "anonymous",
      site: "<input>",
      line: 3,
      column: 16,
    };

    expect(codeFrames("    at anonymous (<input>:5:5)\n    at FL (PLUGIN_7_SOURCE:64:2300)", probe)).toEqual([
      {
        name: "",
        site: "<input>",
        line: 3,
        column: 5,
      },
    ]);
  });
});
