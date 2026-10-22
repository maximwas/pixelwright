import { describe, expect, it } from "vitest";
import { findNodes } from "../src/features/nodes-find/find-nodes.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A file whose plugin is older than variant and counts: its find takes no such input, and lists every instance. */
const olderPlugin: BridgeView = {
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
  request: async () => ({
    nodes: [
      {
        id: "3:2",
        name: "Item",
        type: "INSTANCE",
        box: null,
        path: [],
      },
    ],
    more: false,
  }),
};

describe("nodes_find with a plugin older than the server", () => {
  it("refuses a variant filter it would ignore, rather than list instances of every variant", async () => {
    await expect(
      findNodes(new PluginClient(olderPlugin), {
        variant: "State=Hover",
        limit: 50,
      }),
    ).rejects.toThrow(/older than the server/);
  });

  it("refuses counts it cannot give", async () => {
    await expect(
      findNodes(new PluginClient(olderPlugin), {
        type: "INSTANCE",
        counts: true,
        limit: 50,
      }),
    ).rejects.toThrow(/older than the server/);
  });
});
