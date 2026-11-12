import { type BitDepth, decode, encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { Crop } from "@/core/images/crop.ts";
import type { ImageCodec } from "@/core/ports/image-codec.port.ts";
import type { ImageSniffer } from "@/core/ports/image-sniffer.port.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { ExportPull } from "@/server/app/renders/export-pull.ts";
import { PngRender } from "@/server/app/renders/png-render.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** A 20 x 10 layer at (100, 100) whose shadow paints 2 px around it: the export with effects covers 24 x 14. */
const BOX = { x: 100, y: 100, width: 20, height: 10 };
const PAINTED = { x: 98, y: 98, width: 24, height: 14 };
const HUGE = { x: 0, y: 0, width: 1440, height: 60_000 };

/** fast-png as the codec (a server/app test does not import the adapters); a clip is cut, never sniffed. */
const CODEC: ImageCodec = {
  decode: (png) => decode(png),
  encode: ({ depth, ...image }) => encode({ ...image, depth: depth as BitDepth }),
};
const NO_SNIFFER: ImageSniffer = {
  sniff: () => {
    throw new Error("a clip is cut from the decoded render, never sniffed");
  },
};

/** An RGBA PNG whose every pixel says where it is: red = column, green = row. */
function coordinatePng(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set([x, y, 0, 255], (y * width + x) * 4);
    }
  }

  return encode({ width, height, channels: 4, data });
}

/** A plugin that answers cover as given and renders each layer at the asked scale, from its size in `sizes`. */
class ClippingPlugin implements PluginLink {
  readonly ops: string[] = [];
  readonly exports: unknown[] = [];
  readonly #cover: unknown;
  readonly #sizes: Readonly<Record<string, Box>>;
  #image: Uint8Array = new Uint8Array();

  constructor(cover: unknown, sizes: Readonly<Record<string, Box>>) {
    this.#cover = cover;
    this.#sizes = sizes;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return [];
  }

  async request({ op, input }: OpRequest): Promise<unknown> {
    const asked = input as { node: string; scale: number; offset: number; length: number };

    this.ops.push(op);

    if (op === "cover") {
      return this.#cover;
    }

    if (op === "export") {
      const size = this.#sizes[asked.node] ?? BOX;

      this.exports.push(input);
      this.#image = coordinatePng(size.width * asked.scale, size.height * asked.scale);

      return { scale: asked.scale, totalBytes: this.#image.length };
    }

    return {
      totalBytes: this.#image.length,
      bytes: Buffer.from(this.#image.subarray(asked.offset, asked.offset + asked.length)).toString("base64"),
    };
  }
}

const render = async (
  plugin: ClippingPlugin,
  scale: number,
  clip: Box,
) => {
  const pull = new ExportPull();
  const png = new PngRender(pull, CODEC, NO_SNIFFER, new Crop());
  const image = await png.render(new PluginSession("s1", plugin, []), { node: "1:2", scale, effects: true, clip });

  return decode(image.png);
};

describe("screenshot clip (T-073, O-014)", () => {
  it("crops the asked region of the layer, measured from its box, at the scale", async () => {
    const plugin = new ClippingPlugin(
      { box: BOX, rendered: PAINTED, cover: { node: "1:2", ...BOX, x: 0, y: 0 } },
      { "1:2": PAINTED },
    );
    const png = await render(plugin, 2, { x: 5, y: 2, width: 10, height: 5 });

    expect([png.width, png.height]).toEqual([20, 10]);
    // The box starts 2 px into the painted export: (2 + 5) x 2 = 14, (2 + 2) x 2 = 8.
    expect([...png.data.subarray(0, 2)]).toEqual([14, 8]);
  });

  it("gives the parts of its box nothing paints as transparent, as a text whose glyphs fill less than its box", async () => {
    const glyphs = { x: 102, y: 103, width: 10, height: 4 };
    const plugin = new ClippingPlugin(
      { box: BOX, rendered: glyphs, cover: { node: "1:2", ...BOX, x: 0, y: 0 } },
      { "1:2": glyphs },
    );
    const png = await render(plugin, 1, { x: 0, y: 0, width: 20, height: 10 });
    const pixel = (x: number, y: number) => [
      ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    ];

    expect([png.width, png.height]).toEqual([20, 10]);
    expect(pixel(0, 0)[3]).toBe(0);
    // The glyphs start 2 px right and 3 px down in the box: there the render's first pixel is.
    expect(pixel(2, 3)).toEqual([0, 0, 0, 255]);
  });

  it("refuses a clip of a huge layer before Figma renders it, when no opaque layer inside holds the region", async () => {
    const plugin = new ClippingPlugin({ box: HUGE, rendered: HUGE, cover: { node: "1:2", ...HUGE } }, {});

    await expect(render(plugin, 2, { x: 0, y: 0, width: 100, height: 100 })).rejects.toThrow(
      /renders the whole layer first: 2880×120000 px/,
    );
    expect(plugin.ops).toEqual(["cover"]);
  });

  it("renders the opaque section holding the region alone, which shows it as the whole layer would", async () => {
    const section = { node: "1:9", x: 0, y: 1200, width: 400, height: 300 };
    const plugin = new ClippingPlugin({ box: HUGE, rendered: HUGE, cover: section }, { "1:9": section });
    const png = await render(plugin, 2, { x: 10, y: 1210, width: 50, height: 40 });

    expect(plugin.ops).toEqual(["cover", "export", "chunk"]);
    expect(plugin.exports[0]).toMatchObject({ node: "1:9", effects: false });
    expect([png.width, png.height]).toEqual([100, 80]);
    // The section's pixel (20, 20) is the region's top left: (10, 1210) less the section's place, at scale 2.
    expect([...png.data.subarray(0, 2)]).toEqual([20, 20]);
  });
});
