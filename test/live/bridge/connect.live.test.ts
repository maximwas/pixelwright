import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

describe("bridge/connect", () => {
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it("status shows protocol 7 and Test MCP connected, visible, with Allow edits on", async () => {
    const { status, file } = await client.waitForTestMcp();

    expect(status.server).toMatchObject({ protocol: 7 });
    expect(file).toMatchObject({ name: inject("live").file, visible: true, allowEdits: true });
  });
});
