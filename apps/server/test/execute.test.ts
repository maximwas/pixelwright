import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXECUTE_CODE_CHARS } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { executeCode } from "../src/features/execute/execute-code.ts";
import { ExecuteInputSchema } from "../src/features/execute/schemas.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { RequestOptions } from "../src/types/bridge.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A bridge that records what it is asked and answers each operation from `answers`. */
function recording(answers: Record<string, unknown>) {
  const asked: { op: string; input: unknown; options: RequestOptions | undefined }[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: true,
      },
    ],
    request: async (op, input, options) => {
      asked.push({
        op,
        input,
        options,
      });

      return answers[op];
    },
  };

  return {
    asked,
    client: new PluginClient(bridge),
  };
}

const RAN = {
  result: 42,
  logs: ["hi"],
};

describe("execute", () => {
  it("runs the code in the plugin with its timeout in milliseconds and returns what came back", async () => {
    const { asked, client } = recording({ execute: RAN });

    // The code only reads, so the answer also carries the note the server adds for such code.
    expect(
      await executeCode(
        client,
        ExecuteInputSchema.parse({
          code: "return 42;",
          timeout: 3,
        }),
      ),
    ).toEqual({
      ...RAN,
      note: READS_ONLY,
    });
    expect(
      asked.map(({ op, input }) => ({
        op,
        input,
      })),
    ).toEqual([
      {
        op: "execute",
        input: {
          code: "return 42;",
          timeoutMs: 3_000,
        },
      },
    ]);
  });

  it("waits for the plugin a little past the code's time, however long it is", async () => {
    const { asked, client } = recording({ execute: RAN });

    await executeCode(
      client,
      ExecuteInputSchema.parse({
        code: "x",
        timeout: 120,
      }),
    );

    expect(asked[0]).toMatchObject({
      input: { timeoutMs: 120_000 },
      options: { timeoutMs: 125_000 },
    });
  });

  it("takes up to five minutes, ten seconds by default", () => {
    expect(
      ExecuteInputSchema.safeParse({
        code: "x",
        timeout: 300,
      }).success,
    ).toBe(true);
    expect(
      ExecuteInputSchema.safeParse({
        code: "x",
        timeout: 301,
      }).success,
    ).toBe(false);
    expect(ExecuteInputSchema.parse({ code: "x" }).timeout).toBe(10);
  });

  it("runs a script from the server's disk as the file is at each call", async () => {
    const { asked, client } = recording({ execute: RAN });
    const script = join(await mkdtemp(join(tmpdir(), "pixelwright-execute-")), "dark-copies.js");

    await writeFile(script, "return 1;");
    await executeCode(client, ExecuteInputSchema.parse({ script }));
    await writeFile(script, "return 2;");
    await executeCode(client, ExecuteInputSchema.parse({ script }));

    expect(asked.map(({ input }) => (input as { code: string }).code)).toEqual(["return 1;", "return 2;"]);
  });

  it("refuses code and a script together or neither, and a script it cannot read or run whole", async () => {
    const { asked, client } = recording({ execute: RAN });
    const folder = await mkdtemp(join(tmpdir(), "pixelwright-execute-"));
    const long = join(folder, "long.js");
    const run = (args: object) => executeCode(client, ExecuteInputSchema.parse(args));

    await writeFile(long, "x".repeat(EXECUTE_CODE_CHARS + 1));
    await expect(
      run({
        code: "x",
        script: long,
      }),
    ).rejects.toThrow(/code or script/);
    await expect(run({})).rejects.toThrow(/code or script/);
    await expect(run({ script: join(folder, "missing.js") })).rejects.toThrow(/missing\.js is not a file the server/);
    await expect(run({ script: long })).rejects.toThrow(/100001 characters.*100000/);
    expect(asked).toEqual([]);
  });

  it("answers code that does not parse with where, and says code that breaks off at its end may have been cut", async () => {
    const { asked, client } = recording({ execute: RAN });
    const cut = "the rest was cut on its way to Pixelwright";
    const parsed = (code: string) =>
      executeCode(
        client,
        ExecuteInputSchema.parse({
          code,
          version: "Before",
        }),
      );

    expect(await parsed('const a = 1;\nreturn "M0 0L1')).toEqual({
      result: null,
      logs: [],
      error: `SyntaxError: Invalid or unexpected token\n    at line 2, column 8\nline 2: return "M0 0L1\nThe code ends there, after 27 characters: if you sent more, ${cut} (a model's reply is limited in tokens). Keep long code or data in a file and pass its path as script.`,
    });
    expect((await parsed("if (a) {\nreturn 1;")).error).toMatch(
      /^SyntaxError: .*\n {4}at the end of the code\n.*after 18/,
    );
    expect((await parsed("a b;\nreturn 1;")).error).toBe(
      "SyntaxError: Unexpected identifier 'b'\n    at line 1, column 3\nline 1: a b;",
    );
    expect(asked).toEqual([]);
  });

  it("saves a named version in the file's history before the code runs", async () => {
    const { asked, client } = recording({
      save_version: { id: "v7" },
      execute: RAN,
    });

    expect(
      await executeCode(
        client,
        ExecuteInputSchema.parse({
          code: "x",
          version: "Before the bulk rename",
        }),
      ),
    ).toEqual({
      ...RAN,
      note: READS_ONLY,
      version: {
        id: "v7",
        title: "Before the bulk rename",
      },
    });
    expect(asked.map(({ op }) => op)).toEqual(["save_version", "execute"]);
  });
});

/** What code that only reads is told: the read tools need no code. It says nothing of the file, only of the code. */
const READS_ONLY =
  "This code only reads: design_read, inspect, measure and nodes_find read without code, and work while Allow edits is off.";

/** The answer the server gives for code the plugin ran without an error. */
async function answered(code: string, ran: object = RAN) {
  const { client } = recording({ execute: ran });

  return await executeCode(client, ExecuteInputSchema.parse({ code }));
}

describe("execute's note on code that only reads", () => {
  it.each([
    "return figma.currentPage.children.length;",
    'const card = await pw.node("1:1"); return { name: card.name, box: card.absoluteBoundingBox };',
    [
      "const counts = new Map();",
      "for (const instance of figma.currentPage.findAll((node) => node.type === 'INSTANCE')) {",
      "  const main = await instance.getMainComponentAsync();",
      "  counts.set(main.name, (counts.get(main.name) ?? 0) + 1);",
      "}",
      "return [...counts];",
    ].join("\n"),
    "const out = []; for (const node of figma.currentPage.children) out.push(node.name); return out.join(', ');",
    'const text = await pw.node("1:2"); return await text.getStyledTextSegments(["fontName"]);',
  ])("gives the note to code that only reads: %s", async (code) => {
    expect(await answered(code)).toEqual({
      ...RAN,
      note: READS_ONLY,
    });
  });

  it.each([
    ["a property set", '(await figma.getNodeByIdAsync("1:1")).name = "Card 2";'],
    ["a property set by a computed key", 'const card = await pw.node("1:1"); card["opacity"] = 0.5;'],
    ["a property added to", 'const card = await pw.node("1:1"); card.x += 10;'],
    ["a property counted up", 'const card = await pw.node("1:1"); card.y++;'],
    ["a property deleted", 'const card = await pw.node("1:1"); delete card.foo;'],
    ["a create* call", "figma.createRectangle();"],
    ["remove", '(await pw.node("1:1")).remove();'],
    ["append*", 'figma.currentPage.appendChild(await pw.node("1:1"));'],
    ["insert*", 'figma.currentPage.insertChild(0, await pw.node("1:1"));'],
    ["set*", 'figma.root.setPluginData("seen", "1");'],
    ["set*Async", 'await (await pw.node("1:1")).setFillStyleIdAsync("S:1");'],
    ["resize", '(await pw.node("1:1")).resize(10, 10);'],
    ["rescale", '(await pw.node("1:1")).rescale(2);'],
    ["group", 'figma.group([await pw.node("1:1")], figma.currentPage);'],
    ["flatten", 'figma.flatten([await pw.node("1:1")]);'],
    ["commitUndo", "figma.commitUndo();"],
    ["import*", 'await figma.importComponentByKeyAsync("abc");'],
    ["clone", '(await pw.node("1:1")).clone();'],
    ["detach*", '(await pw.node("1:3")).detachInstance();'],
    ["a boolean operation", 'figma.union([await pw.node("1:1")], figma.currentPage);'],
    ["add*", "(await figma.variables.getLocalVariableCollectionsAsync())[0].addMode('Dark');"],
    ["insertCharacters", '(await pw.node("1:2")).insertCharacters(0, "x");'],
    ["triggerUndo", "figma.triggerUndo();"],
    ["a write by a string key", '(await pw.node("1:1"))["remove"]();'],
    ["a method named by a variable", 'const how = "remove"; (await pw.node("1:1"))[how]();'],
    ["a method taken out", 'const { remove } = await pw.node("1:1"); remove.call(await pw.node("1:1"));'],
    ["a method kept for later", 'const card = await pw.node("1:1"); const gone = card.remove; gone.call(card);'],
    ["Object.assign", 'Object.assign(await pw.node("1:1"), { name: "Card 2" });'],
    ["Reflect", 'Reflect.set(await pw.node("1:1"), "name", "Card 2");'],
    ["eval", 'eval("figma.createRectangle()");'],
    ["Function", 'new Function("figma", "figma.createRectangle()")(figma);'],
    ["a function's constructor", '(() => {}).constructor("figma.createRectangle()")();'],
    ["with", 'with (await pw.node("1:1")) { name = "Card 2"; }'],
  ])("gives no note to code with %s", async (_kind, code) => {
    expect(await answered(code)).not.toHaveProperty("note");
  });

  it.each([
    [
      "in a function the code declares",
      'function rename(node) { node.name = "Card 2"; }\nrename(await pw.node("1:1"));',
    ],
    ["in an arrow function", "const make = () => figma.createRectangle();\nreturn make().id;"],
    ["in a callback", "figma.currentPage.children.forEach((node) => node.remove());"],
    ["in a helper an earlier call added to pw", "return await pw.makeCard();"],
    ["in a helper kept in pw.state", "return pw.state.rename();"],
    ["in a helper taken out of pw", "const { makeCard } = pw;\nreturn makeCard();"],
    ["in a function an earlier call left global", "return makeCard();"],
  ])("gives no note when a write may hide %s", async (_where, code) => {
    expect(await answered(code)).not.toHaveProperty("note");
  });

  it("gives no note when the code threw or ran past its time, though it only reads", async () => {
    const threw = {
      result: null,
      logs: [],
      error: "Error: not this time",
    };

    expect(await answered("return figma.currentPage.name;", threw)).toEqual(threw);
    expect(await answered('throw new Error("not this time");', threw)).toEqual(threw);
  });
});
