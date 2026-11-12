import { describe, expect, it } from "vitest";
import { diffNodes } from "../src/features/nodes-diff/diff-nodes.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** Two variants of one card, a colour apart, as the plugin's snapshot op returns them. */
const card = (id: string, red: number) => ({
  root: {
    id,
    name: `Card ${id}`,
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    childCount: 1,
    layoutMode: "VERTICAL",
    children: [
      {
        id: `${id}0`,
        name: "Badge",
        type: "RECTANGLE",
        visible: true,
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        childCount: 0,
        fills: [
          {
            type: "SOLID",
            visible: true,
            color: {
              r: red,
              g: 0,
              b: 0,
            },
          },
        ],
      },
    ],
  },
  styles: {},
  variables: {},
});

function bridgeOf(asked: { op: string; node: string; session: string | undefined }[]): BridgeView {
  return {
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
      const { node } = input as { node: string };

      asked.push({
        op,
        node,
        session: target?.session,
      });

      return card(node, node === "1:1" ? 1 : 0.5);
    },
  };
}

describe("nodes_diff", () => {
  it("reads both layers from one file and says how the second differs", async () => {
    const asked: { op: string; node: string; session: string | undefined }[] = [];
    const result = await diffNodes(new PluginClient(bridgeOf(asked)), {
      a: "1:1",
      b: "2:1",
    });

    expect(asked.map(({ op, node, session }) => [op, node, session])).toEqual([
      ["snapshot", "1:1", "s1"],
      ["snapshot", "2:1", "s1"],
    ]);
    expect(result).toMatchObject({
      same: false,
      changed: [
        {
          path: 'Rectangle "Badge"',
          attributes: { background: ["#F00", "#800000"] },
        },
      ],
    });
    expect(result.summary).toMatch(/1:1 "Card 1:1" and 2:1 "Card 2:1": 1 layer differs/);
  });
});
