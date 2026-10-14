import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXPORT_CHUNK_BYTES } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { takeScreenshot } from "../src/images/screenshot.ts";
import { exportBytes } from "../src/plugin/export-bytes.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** The plugin session a call works on, over a test bridge. */
const sessionOf = (bridge: BridgeView) => new PluginClient(bridge).session();

/** A PNG's signature and IHDR chunk with the given size, padded with filler bytes to `length`. */
function fakePng(width: number, height: number, length = 64): Buffer {
  const png = Buffer.alloc(length, 7);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(png, 0);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);

  return png;
}

/** A bridge whose one plugin exports `image`, answering each chunk request like the plugin does. */
function exportingBridge(image: Buffer, scale = 1) {
  const requests: { offset: number; length: number; maxSide?: number }[] = [];
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
    request: async (_op, input) => {
      const { offset, length, maxSide } = input as { offset: number; length: number; maxSide?: number };

      requests.push({
        offset,
        length,
        ...(maxSide === undefined ? {} : { maxSide }),
      });

      return {
        scale,
        totalBytes: image.length,
        bytes: image.subarray(offset, offset + length).toString("base64"),
      };
    },
  };

  return {
    bridge,
    requests,
  };
}

describe("exportBytes", () => {
  it("puts an export bigger than one message back together from its chunks", async () => {
    const image = Buffer.alloc(EXPORT_CHUNK_BYTES * 2 + 5);

    for (let index = 0; index < image.length; index++) {
      image[index] = index % 251;
    }

    const { bridge, requests } = exportingBridge(image);
    const { bytes } = await exportBytes(sessionOf(bridge), {
      node: "2:4868",
      format: "PNG",
      scale: 1,
      effects: true,
    });

    expect(requests.map((request) => request.offset)).toEqual([0, EXPORT_CHUNK_BYTES, EXPORT_CHUNK_BYTES * 2]);
    expect(bytes.equals(image)).toBe(true);
  });
});

describe("screenshot", () => {
  it("refuses an image the plugin could not fit, saying its size and how to get it", async () => {
    const { bridge } = exportingBridge(fakePng(1440, 8000));

    await expect(
      takeScreenshot(sessionOf(bridge), {
        node: "2:4766",
        scale: 1,
        effects: true,
      }),
    ).rejects.toThrow(/1440×8000.*scale 0\.25.*save/s);
  });

  it("writes the whole image to `save` and answers with its path and size", async () => {
    const image = fakePng(1440, 8000);
    const { bridge } = exportingBridge(image);
    const save = join(await mkdtemp(join(tmpdir(), "pixelwright-")), "shots", "landing.png");
    const result = await takeScreenshot(sessionOf(bridge), {
      node: "2:4766",
      scale: 1,
      effects: true,
      save,
    });

    expect((await readFile(save)).equals(image)).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: expect.stringContaining(`"path":"${save}"`),
      },
    ]);
    expect((result.content[0] as { text: string }).text).toContain('"width":1440,"height":8000');
  });

  it("asks the plugin to fit the image into 2000 px and says when it had to scale down", async () => {
    const { bridge, requests } = exportingBridge(fakePng(360, 2000), 0.25);
    const result = await takeScreenshot(sessionOf(bridge), {
      node: "2:4766",
      scale: 1,
      effects: true,
    });

    expect(requests[0]).toMatchObject({ maxSide: 2_000 });
    expect(result.content[1]).toEqual({
      type: "text",
      text: expect.stringMatching(/360×2000 px at scale 0\.25.*at scale 1 it is 1440×8000 px/s),
    });
  });

  it("returns a small image inline with a line naming the node and its size", async () => {
    const image = fakePng(600, 310);
    const { bridge } = exportingBridge(image);
    const result = await takeScreenshot(sessionOf(bridge), {
      node: "2:4869",
      scale: 1,
      effects: true,
    });

    expect(result.content).toEqual([
      {
        type: "image",
        data: image.toString("base64"),
        mimeType: "image/png",
      },
      {
        type: "text",
        text: expect.stringMatching(/2:4869.*600×310/),
      },
    ]);
  });
});

describe("screenshot review fixes", () => {
  it("saves only to a .png path and never over a file that is not a PNG", async () => {
    const { writeFile } = await import("node:fs/promises");
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-"));
    const notes = join(dir, "notes.png");
    const { bridge } = exportingBridge(fakePng(100, 100));

    await writeFile(notes, "my notes");

    await expect(
      takeScreenshot(sessionOf(bridge), {
        node: "1:1",
        scale: 1,
        effects: true,
        save: join(dir, "shot.txt"),
      }),
    ).rejects.toThrow(/\.png/);
    await expect(
      takeScreenshot(sessionOf(bridge), {
        node: "1:1",
        scale: 1,
        effects: true,
        save: notes,
      }),
    ).rejects.toThrow(/not a PNG/);
    expect(await readFile(notes, "utf8")).toBe("my notes");

    const shot = join(dir, "shot.png");

    await takeScreenshot(sessionOf(bridge), {
      node: "1:1",
      scale: 1,
      effects: true,
      save: shot,
    });
    await takeScreenshot(sessionOf(bridge), {
      node: "1:1",
      scale: 1,
      effects: true,
      save: shot,
    });
    expect((await readFile(shot)).equals(fakePng(100, 100))).toBe(true);
  });

  it("scales an image down again when its bytes are too many to return inline", async () => {
    const scales: number[] = [];
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
      request: async (_op, input) => {
        const { offset, length, scale } = input as { offset: number; length: number; scale: number };

        if (offset === 0) {
          scales.push(scale);
        }

        // A photo-heavy render: about 5 MB at scale 1, a quarter of that at half the scale.
        const image = scale >= 1 ? fakePng(2000, 1500, 5_000_000) : fakePng(1000, 750, 1_200_000);

        return {
          scale,
          totalBytes: image.length,
          bytes: image.subarray(offset, offset + length).toString("base64"),
        };
      },
    };
    const result = await takeScreenshot(sessionOf(bridge), {
      node: "1:1",
      scale: 1,
      effects: true,
    });

    expect(scales[0]).toBe(1);
    expect(scales.at(-1)).toBeLessThan(1);
    expect((result.content[1] as { text: string }).text).toMatch(/1000×750 px/);
  });
});
