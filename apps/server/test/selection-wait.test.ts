import { describe, expect, it } from "vitest";
import type { BridgeView } from "../src/types/mcp.ts";
import { waitForSelection } from "../src/watch/wait-selection.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const TITLE = {
  id: "1:2",
  name: "Title",
  type: "TEXT",
  box: null,
};

describe("selection_wait", () => {
  it("waits in rounds the bridge allows, from the selection the first round started with", async () => {
    const asked: unknown[] = [];
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
      request: async (op, input) => {
        asked.push([op, input]);

        return asked.length === 1
          ? {
              changed: false,
              from: ["1:1"],
              nodes: [],
            }
          : {
              changed: true,
              from: ["1:1"],
              nodes: [TITLE],
            };
      },
    };

    await expect(waitForSelection(bridge, { timeout: 60 })).resolves.toEqual({
      changed: true,
      nodes: [TITLE],
    });
    expect(asked).toEqual([
      [
        "selection_wait",
        {
          timeoutMs: 25_000,
          from: null,
        },
      ],
      [
        "selection_wait",
        {
          timeoutMs: 25_000,
          from: ["1:1"],
        },
      ],
    ]);
  });
});
