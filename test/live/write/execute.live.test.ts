import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";
import { until } from "../support/until.ts";

const NAME = { rectangle: "live:execute:rectangle", later: "live:execute:later" } as const;

/** How long the test waits for code that outlived its call: it makes its layer 2 s in. */
const LATER_WAIT_MS = 15_000;

// Writes, so no retry: an execute that timed out keeps running and finishes later (m:8cfa2bfd), so read back first.
describe("write/execute", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = (code: string, timeout?: number): Promise<ToolResult> =>
    client.call("execute", { file, code, ...(timeout === undefined ? {} : { timeout }) });

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("makes a rectangle in the scratch Section and returns its id; reading it back only reads (T-150, T-153)", async () => {
    const made = await run(`const section = await pw.node(${JSON.stringify(scratch)});
const rectangle = figma.createRectangle();
rectangle.name = ${JSON.stringify(NAME.rectangle)};
section.appendChild(rectangle);
return rectangle.id;`);

    expect(made).toEqual({ result: expect.any(String), logs: [] });

    const read = await run(`return (await pw.node(${JSON.stringify(made.result)})).name;`);

    expect(read).toEqual({ result: NAME.rectangle, logs: [], note: expect.stringContaining("This code only reads") });
  });

  it("prints console.log(undefined) as undefined and reports a thrown {message} by its message (D-68)", async () => {
    expect(await run('console.log(undefined); throw { message: "x" };')).toEqual({
      result: null,
      logs: ["undefined"],
      error: "x",
    });
  });

  it("hands the code a figma without clientStorage, ui, closePlugin and showUI: it cannot flip Allow edits or the window (D-11)", async () => {
    expect(
      (
        await run(
          "return [typeof figma.clientStorage, typeof figma.ui, typeof figma.closePlugin, typeof figma.showUI, typeof figma.createFrame];",
        )
      ).result,
    ).toEqual(["undefined", "undefined", "undefined", "undefined", "function"]);
  });

  it("keeps running code that outlives its call; its layer appears later, as pixelwright's change (T-156, A§15.9)", async () => {
    const { cursor } = await client.call("changes_since", { file });
    const started = await run(
      `await new Promise((resolve) => setTimeout(resolve, 2000));
const section = await pw.node(${JSON.stringify(scratch)});
const later = figma.createRectangle();
later.name = ${JSON.stringify(NAME.later)};
section.appendChild(later);`,
      1,
    );

    expect(started.error).toContain("ran past 1000 ms: it may still be running");

    const later = await until(async () => {
      const found = await run(`const section = await pw.node(${JSON.stringify(scratch)});
return section.findChild((node) => node.name === ${JSON.stringify(NAME.later)})?.id ?? null;`);

      return typeof found.result === "string" ? found.result : null;
    }, LATER_WAIT_MS);

    expect(later).toEqual(expect.any(String));

    const change = await until(async () => {
      const { changes } = await client.call("changes_since", { file, cursor });

      return (changes as { id: string; by: string }[]).find(({ id }) => id === later) ?? null;
    }, LATER_WAIT_MS);

    expect(change).toMatchObject({ id: later, name: NAME.later, change: "created", by: "pixelwright" });
  });
});
