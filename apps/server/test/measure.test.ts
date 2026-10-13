import { describe, expect, it } from "vitest";
import { measureNodes } from "../src/layers/measure-layers.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** Two cards in a row as the inspect op reads them, and an id that is not a layer. */
const card = (id: string, x: number) => ({
  id,
  name: `Card ${id}`,
  type: "FRAME",
  visible: true,
  x,
  y: 0,
  width: 100,
  height: 50,
  childCount: 0,
  parent: null,
  box: {
    x,
    y: 0,
    width: 100,
    height: 50,
  },
  paintedBox: null,
  parentBox: null,
  parentPadding: null,
});

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
    expect(op).toBe("inspect");
    expect(input).toEqual({ nodes: ["1:1", "1:2", "9:9"] });

    return {
      origin: null,
      layers: [card("1:1", 0), card("1:2", 116)],
      missing: ["9:9"],
    };
  },
};

describe("measure", () => {
  it("measures the layers named in order, from their layout boxes, and names the missing ones", async () => {
    const result = await measureNodes(bridge, {
      nodes: ["1:1", "1:2", "9:9"],
      painted: false,
    });

    expect(result).toMatchObject({
      measured: "box",
      missing: ["9:9"],
      pairs: [
        {
          gap: {
            x: 16,
            y: -50,
          },
          summary: expect.stringMatching(/^1:2 "Card 1:2" is 16 px right of 1:1 "Card 1:1"/),
        },
      ],
    });
  });
});
