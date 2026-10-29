import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install } = TEST_MCP.ids;
const START_HERE = TEST_MCP.pages[0];

/** How long a selection_wait gets to start its first round before the test changes the selection or gives up. */
const ROUND_START_MS = 1_000;

const SELECT_NONE = "figma.currentPage.selection = [];";
const SELECT_INSTALL = `figma.currentPage.selection = [await pw.node(${JSON.stringify(install)})];`;

interface Layer {
  readonly id: string;
}

const ids = (layers: unknown): string[] => (layers as Layer[]).map(({ id }) => id);

// It moves the view and changes the selection (through execute too), so no retry; it leaves nothing selected.
describe("read/navigation", () => {
  const { file } = inject("live");
  let client: LiveClient;

  const select = (code: string) => client.call("execute", { file, code });

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await select(SELECT_NONE);
    await client.close();
  });

  it("node_show of the Install card selects it, and selection_get returns it (T-032)", async () => {
    expect(await client.call("node_show", { file, node: install })).toEqual({
      nodes: [{ id: install, name: expect.any(String) }],
      page: START_HERE,
      zoom: expect.any(Number),
    });
    expect(ids((await client.call("selection_get", { file })).nodes)).toEqual([install]);
  });

  it("lists the card in view after node_show fits it, select: false leaving the selection alone (T-033)", async () => {
    await select(SELECT_NONE);
    await client.call("node_show", { file, nodes: [install], zoom: "fit", select: false });

    const view = await client.call("viewport_get", { file });

    expect(view).toMatchObject({ page: START_HERE, zoom: expect.any(Number), more: expect.any(Boolean) });
    expect(ids(view.layers)).toContain(install);
    expect((await client.call("selection_get", { file })).nodes).toEqual([]);
  });

  it("selection_wait returns when an execute changes the selection (T-031)", async () => {
    await select(SELECT_NONE);

    const waiting = client.call("selection_wait", { file, timeout: 30 });

    await sleep(ROUND_START_MS);
    await select(SELECT_INSTALL);

    const waited = await waiting;

    expect(waited.changed).toBe(true);
    expect(ids(waited.nodes)).toEqual([install]);
  });

  it("an aborted selection_wait ends the call at once, and the file answers while its round runs out (T-014)", async () => {
    const abort = new AbortController();
    const waiting = client.call("selection_wait", { file, timeout: 60 }, abort.signal);

    await sleep(ROUND_START_MS);
    abort.abort();

    await expect(waiting).rejects.toThrow();
    expect(ids((await client.call("selection_get", { file })).nodes)).toEqual([install]);
  });
});
