import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

describe("bridge/peer", () => {
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("joins the setup's server as a peer and pings Test MCP through it (R-036, S-032)", async () => {
    const status = await client.call("status", { probe: true });

    expect(status.server).toMatchObject({ role: "peer" });
    expect(status.probe).toMatchObject({ ok: true });
  });
});
