import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEditsAllowed } from "../src/figma/edits.ts";
import { runOperation } from "../src/figma/operations.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

interface Ran {
  result: unknown;
  logs: string[];
  error?: string;
}

let fake: ReturnType<typeof installFigma>;
const run = async (code: string, timeoutMs = 1_000) =>
  (await runOperation("execute", {
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
  setEditsAllowed(true);
});

afterEach(() => {
  setEditsAllowed(false);
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
      error: "Error: boom",
    });
    expect(fake.writes.undo).toBe(1);
    expect((await run("return (")).error).toMatch(/SyntaxError/);
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

  it("refuses to run while Allow edits is off", async () => {
    setEditsAllowed(false);

    await expect(run("return 1;")).rejects.toMatchObject({ code: "EDITS_DISABLED" });
  });
});
