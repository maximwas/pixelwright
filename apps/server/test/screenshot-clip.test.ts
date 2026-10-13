import { decode, encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { takeScreenshot } from "../src/mcp/tools/screenshot.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A 20×10 layer at (100, 100) whose shadow paints 2 px around it: the export with effects covers 24×14. */
const BOX = {
  x: 100,
  y: 100,
  width: 20,
  height: 10,
};
const PAINTED = {
  x: 98,
  y: 98,
  width: 24,
  height: 14,
};

/** An RGBA PNG whose every pixel says where it is: red = column, green = row. */
function coordinatePng(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set([x, y, 0, 255], (y * width + x) * 4);
    }
  }

  return encode({
    width,
    height,
    channels: 4,
    data,
  });
}

/** A bridge that inspects the layer as above and exports it at the asked scale, painted box and all. */
function clippingBridge() {
  const ops: string[] = [];
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
      ops.push(op);

      if (op === "inspect") {
        return {
          origin: null,
          missing: [],
          layers: [
            {
              id: "1:2",
              name: "Card",
              type: "FRAME",
              visible: true,
              x: BOX.x,
              y: BOX.y,
              width: BOX.width,
              height: BOX.height,
              childCount: 0,
              parent: null,
              box: BOX,
              paintedBox: PAINTED,
              parentBox: null,
              parentPadding: null,
            },
          ],
        };
      }

      const { scale, offset, length } = input as { scale: number; offset: number; length: number };
      const image = Buffer.from(coordinatePng(PAINTED.width * scale, PAINTED.height * scale));

      return {
        scale,
        totalBytes: image.length,
        bytes: image.subarray(offset, offset + length).toString("base64"),
      };
    },
  };

  return {
    bridge,
    ops,
  };
}

const imageOf = (result: Awaited<ReturnType<typeof takeScreenshot>>) => {
  const image = result.content.find((part) => part.type === "image");

  return decode(Buffer.from((image as { data: string }).data, "base64"));
};

describe("screenshot clip", () => {
  it("crops the asked region of the layer, measured from its box, at the scale", async () => {
    const { bridge } = clippingBridge();
    const result = await takeScreenshot(bridge, {
      node: "1:2",
      scale: 2,
      effects: true,
      clip: {
        x: 5,
        y: 2,
        width: 10,
        height: 5,
      },
    });
    const png = imageOf(result);

    expect([png.width, png.height]).toEqual([20, 10]);
    // The box starts 2 px into the painted export: (2 + 5) × 2 = 14, (2 + 2) × 2 = 8.
    expect([...png.data.subarray(0, 2)]).toEqual([14, 8]);
  });

  it("says the layer's size when the clip reaches past what is painted", async () => {
    const { bridge } = clippingBridge();

    await expect(
      takeScreenshot(bridge, {
        node: "1:2",
        scale: 1,
        effects: true,
        clip: {
          x: 15,
          y: 0,
          width: 10,
          height: 5,
        },
      }),
    ).rejects.toThrow(/20×10/);
  });
});
