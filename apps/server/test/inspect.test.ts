import type { InspectRaw } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { inspectLayers } from "../src/mcp/tools/inspect.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const RAW: InspectRaw = {
  origin: null,
  missing: [],
  layers: [
    {
      id: "2:4",
      name: "Rule",
      type: "LINE",
      visible: true,
      x: 0,
      y: 100,
      width: 100,
      height: 0,
      childCount: 0,
      parent: null,
      box: {
        x: 0,
        y: 100,
        width: 100,
        height: 0,
      },
      paintedBox: {
        x: -0.5,
        y: 99.5,
        width: 101,
        height: 1,
      },
      parentBox: null,
      parentPadding: null,
    },
  ],
};

/** A bridge with one file: the selection holds `selected`, inspect answers RAW; each request is recorded. */
function bridge(selected: string[]) {
  const requests: { op: string; input: unknown }[] = [];
  const view: BridgeView = {
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
      requests.push({
        op,
        input,
      });

      return op === "selection"
        ? {
            nodes: selected.map((id) => ({
              id,
              name: id,
              type: "LINE",
              box: null,
            })),
          }
        : RAW;
    },
  };

  return {
    view,
    requests,
  };
}

describe("the inspect tool", () => {
  it("inspects the selection when no layers are named, and gives the view", async () => {
    const { view, requests } = bridge(["2:4"]);
    const result = await inspectLayers(view, {});

    expect(requests.map(({ op, input }) => [op, input])).toEqual([
      ["selection", null],
      ["inspect", { nodes: ["2:4"] }],
    ]);
    expect(result.relativeTo).toBe("the page");
    expect(result.layers[0]?.paintedBox).toEqual({
      x: -0.5,
      y: 99.5,
      width: 101,
      height: 1,
    });
  });

  it("says what to do when nothing is selected and no layers are named", async () => {
    const { view } = bridge([]);

    await expect(inspectLayers(view, {})).rejects.toThrow(/select|nodes/i);
  });
});
