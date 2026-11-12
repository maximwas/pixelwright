import { describe, expect, it } from "vitest";
import { readVariants } from "../src/features/variants-read/read-variants.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const variant = (id: string, name: string, x: number) => ({
  id,
  name,
  type: "COMPONENT",
  visible: true,
  x,
  y: 0,
  width: 120,
  height: 40,
  childCount: 0,
  layoutMode: "HORIZONTAL",
});

describe("variants_read", () => {
  it("finds the set of an instance on one file and compares its variants", async () => {
    const asked: [string, unknown, string | undefined][] = [];
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
      request: async (op, input, target) => {
        asked.push([op, input, target?.session]);

        return op === "set_of"
          ? {
              id: "5:1",
              name: "Button",
            }
          : {
              root: {
                id: "5:1",
                name: "Button",
                type: "COMPONENT_SET",
                visible: true,
                x: 0,
                y: 0,
                width: 300,
                height: 40,
                childCount: 2,
                children: [variant("5:2", "State=Default", 0), variant("5:3", "State=Hover", 140)],
              },
              styles: {},
              variables: {},
            };
      },
    };

    await expect(readVariants(new PluginClient(bridge), { node: "5:9" })).resolves.toMatchObject({
      set: { name: "Button" },
      variants: [
        {
          name: "State=Hover",
          pseudo: ":hover",
          same: true,
        },
      ],
    });
    expect(asked.map(([op, input, session]) => [op, (input as { node: string }).node, session])).toEqual([
      ["set_of", "5:9", "s1"],
      ["snapshot", "5:1", "s1"],
    ]);
  });
});
