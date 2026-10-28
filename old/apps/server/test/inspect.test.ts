import type { InspectRaw } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { inspectLayers } from "../src/features/inspect/inspect-layers.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
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

/** A bridge with one file: the selection holds `selected`, inspect answers RAW (or `inspected`); each request is recorded. */
function bridge(
  selected: string[],
  inspected: (input: { nodes: string[]; relativeTo?: string }) => InspectRaw = () => RAW,
) {
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
        : inspected(input as { nodes: string[] });
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
    const result = await inspectLayers(new PluginClient(view), {});

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

    await expect(inspectLayers(new PluginClient(view), {})).rejects.toThrow(/select|nodes/i);
  });
});

describe("inspect of a big selection", () => {
  it("reads the first 100 layers and says how many it left", async () => {
    const { view, requests } = bridge(Array.from({ length: 103 }, (_, index) => `3:${index + 1}`));
    const result = await inspectLayers(new PluginClient(view), {});

    expect((requests[1]?.input as { nodes: string[] } | undefined)?.nodes).toHaveLength(100);
    expect(result.left).toBe(3);
  });
});

describe("inspect around a point", () => {
  const rule = RAW.layers[0] as InspectRaw["layers"][number];
  /**
   * A 200 px ring at the top left of section 2:1, which sits at (300, 300) on the page: the plugin gives its box from
   * the origin it is asked for, as Figma's inspect op does.
   */
  const ringIn = (relativeTo: string | undefined) => ({
    ...rule,
    id: "2:9",
    name: "Ring",
    type: "ELLIPSE",
    box: {
      x: relativeTo === "2:1" ? 0 : 300,
      y: relativeTo === "2:1" ? 0 : 300,
      width: 200,
      height: 200,
    },
  });
  const rawFor = ({ nodes, relativeTo }: { nodes: string[]; relativeTo?: string }): InspectRaw => ({
    ...RAW,
    layers: nodes.includes("2:9") ? [ringIn(relativeTo)] : RAW.layers,
  });

  it("measures from the centre of the layer around names, read in the same origin as the boxes", async () => {
    const { view } = bridge([], rawFor);
    const result = await inspectLayers(new PluginClient(view), {
      nodes: ["2:4"],
      relativeTo: "2:1",
      around: "2:9",
    });

    expect(result.around).toEqual({
      x: 100,
      y: 100,
    });
    // The rule's box runs from (0, 100) 100 px wide: its centre is 50 px left of the ring's.
    expect(result.layers[0]).toMatchObject({
      center: {
        x: 50,
        y: 100,
      },
      distance: 50,
      angle: 270,
    });
  });

  it("measures from a point given in the boxes' origin", async () => {
    const { view } = bridge([], rawFor);
    const result = await inspectLayers(new PluginClient(view), {
      nodes: ["2:4"],
      around: {
        x: 50,
        y: 0,
      },
    });

    expect(result.around).toEqual({
      x: 50,
      y: 0,
    });
    expect(result.layers[0]).toMatchObject({
      distance: 100,
      angle: 180,
    });
  });

  it("says so when the layer around names is not in the file", async () => {
    const { view } = bridge([], ({ nodes }) => ({
      ...RAW,
      layers: nodes.includes("9:9") ? [] : RAW.layers,
      missing: nodes.includes("9:9") ? ["9:9"] : [],
    }));

    await expect(
      inspectLayers(new PluginClient(view), {
        nodes: ["2:4"],
        around: "9:9",
      }),
    ).rejects.toThrow(/9:9/);
  });
});
