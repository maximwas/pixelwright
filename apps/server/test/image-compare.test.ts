import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decode, encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { compareImage } from "../src/features/image-compare/compare-image.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A white 20×10 PNG with a black bar two rows tall starting at row `bar`. */
function barPng(bar: number, width = 20, height = 10): Uint8Array {
  const data = new Uint8Array(width * height * 4).fill(255);

  for (let y = bar; y < bar + 2; y++) {
    for (let x = 0; x < width; x++) {
      data.set([0, 0, 0, 255], (y * width + x) * 4);
    }
  }

  return encode({
    width,
    height,
    channels: 4,
    data,
  });
}

/** A 96×96 bell icon (dome, flared body, rim, clapper), antialiased by `samples`² coverage samples from `offset`. */
function bellPng(samples: number, offset: number): Uint8Array {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  const ellipse = (x: number, y: number, [cx, cy, rx, ry]: number[]) =>
    ((x - (cx ?? 0)) / (rx ?? 1)) ** 2 + ((y - (cy ?? 0)) / (ry ?? 1)) ** 2 <= 1;
  const inside = (x: number, y: number) =>
    ellipse(x, y, [48, 36, 22, 22]) ||
    (y >= 36 && y <= 70 && ellipse(x, y, [48, 70, 26 - (70 - y) / 6, 40])) ||
    ellipse(x, y, [48, 70, 34, 5]) ||
    ellipse(x, y, [48, 82, 7, 7]) ||
    ellipse(x, y, [48, 12, 4, 4]);

  for (let pixel = 0; pixel < size * size; pixel++) {
    const [x, y] = [pixel % size, Math.floor(pixel / size)];
    const hits = Array.from({ length: samples ** 2 }, (_, sample) =>
      inside(x + ((sample % samples) + offset) / samples, y + (Math.floor(sample / samples) + offset) / samples),
    ).filter(Boolean).length;

    data.set([20, 20, 20, Math.round((255 * hits) / samples ** 2)], pixel * 4);
  }

  return encode({
    width: size,
    height: size,
    channels: 4,
    data,
  });
}

/** A bridge whose layer renders to `png`. */
function rendering(png: Uint8Array): BridgeView {
  const bytes = Buffer.from(png);

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
    request: async (_op, input) => {
      const { offset, length } = input as { offset: number; length: number };

      return {
        scale: 1,
        totalBytes: bytes.length,
        bytes: bytes.subarray(offset, offset + length).toString("base64"),
      };
    },
  };
}

/** A bridge whose layers render to the PNGs by their id. */
function renderingEach(pngs: Record<string, Uint8Array>): BridgeView {
  return {
    ...rendering(new Uint8Array()),
    request: async (_op, input) => {
      const { node, offset, length } = input as { node: string; offset: number; length: number };
      const bytes = Buffer.from(pngs[node] ?? new Uint8Array());

      return {
        scale: 1,
        totalBytes: bytes.length,
        bytes: bytes.subarray(offset, offset + length).toString("base64"),
      };
    },
  };
}

async function reference(png: Uint8Array): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "pixelwright-compare-")), "build.png");

  await writeFile(path, png);

  return path;
}

const ask = async (render: Uint8Array, wanted: Uint8Array, extra: object = {}) =>
  compareImage(new PluginClient(rendering(render)), {
    node: "1:2",
    reference: await reference(wanted),
    scale: 1,
    effects: true,
    ...extra,
  });

describe("image_compare", () => {
  it("finds no difference between a render and the same image", async () => {
    const result = await ask(barPng(4), barPng(4));

    expect(result).toMatchObject({
      rmse: 0,
      different: 0,
      box: null,
      rows: {
        matched: 2,
        shifted: [],
      },
    });
  });

  it("says where the render differs and by how many px its edges are off", async () => {
    const result = await ask(barPng(6), barPng(4));

    expect(result.rmse).toBeGreaterThan(0);
    expect(result.different).toBeCloseTo(0.4, 5);
    expect(result.box).toEqual({
      x: 0,
      y: 4,
      width: 20,
      height: 4,
    });
    expect(result.rows.shifted).toEqual([
      {
        reference: 4,
        node: 6,
        by: 2,
      },
      {
        reference: 6,
        node: 8,
        by: 2,
      },
    ]);
  });

  it("reads a curved icon antialiased another way as the same edges, off by 1 px at most", async () => {
    const result = await ask(bellPng(16, 0.5), bellPng(3, 0.5));

    expect(result.rmse).toBeLessThan(5);

    for (const edges of [result.rows, result.columns]) {
      expect(edges.shifted.filter(({ by }) => Math.abs(by) > 1)).toEqual([]);
      expect(edges.missing).toEqual([]);
      expect(edges.extra).toEqual([]);
    }
  });

  it("compares the part both cover when the sizes differ, and says so", async () => {
    const result = await ask(barPng(4), barPng(4, 20, 12));

    expect(result.size).toEqual({
      node: "20×10",
      reference: "20×12",
    });
    expect(result.note).toMatch(/sizes differ/);
  });

  it("writes the difference as a PNG when asked: the render faded, the differing pixels red", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "pixelwright-diff-")), "diff.png");
    const result = await ask(barPng(6), barPng(4), { diff: path });
    const image = decode(await readFile(path));
    const pixel = (x: number, y: number) => [...image.data.subarray((y * 20 + x) * 4, (y * 20 + x) * 4 + 3)];

    expect(result.diff).toBe(path);
    expect(pixel(0, 4)).toEqual([255, 0, 0]);
    expect(pixel(0, 0)).not.toEqual([255, 0, 0]);
  });

  it("refuses a reference that is not a PNG", async () => {
    await expect(ask(barPng(4), new TextEncoder().encode("not a png"))).rejects.toThrow(/not a PNG/);
  });

  it("compares a layer against another layer, with no file on disk", async () => {
    const result = await compareImage(
      new PluginClient(
        renderingEach({
          "1:2": barPng(6),
          "1:3": barPng(4),
        }),
      ),
      {
        node: "1:2",
        against: "1:3",
        scale: 1,
        effects: true,
      },
    );

    expect(result.size).toEqual({
      node: "20×10",
      reference: "20×10",
    });
    expect(result.rows.shifted.map(({ by }) => by)).toEqual([2, 2]);
  });

  it("asks for a PNG or another layer, one of them", async () => {
    const client = new PluginClient(rendering(barPng(4)));
    const base = {
      node: "1:2",
      scale: 1,
      effects: true,
    };

    await expect(compareImage(client, base)).rejects.toThrow(/reference.*against/);
    await expect(
      compareImage(client, {
        ...base,
        reference: await reference(barPng(4)),
        against: "1:3",
      }),
    ).rejects.toThrow(/one of them/);
  });
});
