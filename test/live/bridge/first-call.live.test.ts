import { afterAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

// A server that has just started has no plugin yet: the plugin reconnects with a backoff of up to 15 s. The call
// itself waits for it (T-001); nothing polls status first.
describe("bridge/first call", () => {
  const { file } = inject("live");
  let client: LiveClient | undefined;

  afterAll(async () => {
    await client?.close();
  });

  it("answers a fresh server's first call to Test MCP, without PLUGIN_NOT_CONNECTED", async () => {
    client = await new LiveClient().connect();

    const { pages } = await client.call("file_map", { file });

    expect(pages).not.toHaveLength(0);
  });
});
