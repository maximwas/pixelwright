import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

// Read-only: nothing to undo, so a slow first answer may retry.
describe("read/selection", { retry: 2 }, () => {
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("gives an empty list while nothing is selected in Test MCP (T-030)", async () => {
    expect(await client.call("selection_get", { file: inject("live").file })).toEqual({ nodes: [] });
  });
});
