import { describe, expect, it } from "vitest";
import { EdgeDiff } from "@/core/images/edge-diff.ts";
import { ImageComparison } from "@/core/images/image-comparison.ts";
import { Rgba } from "@/core/images/rgba.ts";
import { Rmse } from "@/core/images/rmse.ts";
import type { RgbaImage } from "@/core/ports/pixel-diff.port.ts";
import { PixelmatchDiff } from "@/server/adapters/images/pixelmatch-diff.ts";

const rgba = new Rgba();
const edges = new EdgeDiff(rgba);

/** The comparison as the server root binds it. */
const comparison = new ImageComparison(rgba, new Rmse(rgba), edges, new PixelmatchDiff());

/** White, with bars two rows tall starting at each of `rows`, `length` px of each row from the left, in `grey`. */
const bars = ({
  rows,
  width = 20,
  height = 10,
  length = width,
  grey = 0,
}: {
  rows: number[];
  width?: number;
  height?: number;
  length?: number;
  grey?: number;
}): RgbaImage => {
  const data = new Uint8Array(width * height * 4).fill(255);

  for (const row of rows) {
    for (let y = row; y < row + 2; y++) {
      for (let x = 0; x < length; x++) {
        data.set([grey, grey, grey, 255], (y * width + x) * 4);
      }
    }
  }

  return { width, height, channels: 4, depth: 8, data };
};

/** A 96×96 bell icon (dome, flared body, rim, clapper), antialiased by `samples`² coverage samples from `offset`. */
const bell = (samples: number, offset: number): RgbaImage => {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  const ellipse = (
    x: number,
    y: number,
    [cx, cy, rx, ry]: number[],
  ) =>
    ((x - (cx ?? 0)) / (rx ?? 1)) ** 2 + ((y - (cy ?? 0)) / (ry ?? 1)) ** 2 <= 1;
  const inside = (x: number, y: number) =>
    ellipse(x, y, [48, 36, 22, 22]) ||
    (y >= 36 && y <= 70 && ellipse(x, y, [48, 70, 26 - (70 - y) / 6, 40])) ||
    ellipse(x, y, [48, 70, 34, 5]) ||
    ellipse(x, y, [48, 82, 7, 7]) ||
    ellipse(x, y, [48, 12, 4, 4]);

  for (let pixel = 0; pixel < size * size; pixel++) {
    const [x, y] = [pixel % size, Math.floor(pixel / size)];
    const hits = Array.from({ length: samples ** 2 }, (_empty, sample) =>
      inside(x + ((sample % samples) + offset) / samples, y + (Math.floor(sample / samples) + offset) / samples),
    ).filter(Boolean).length;

    data.set([20, 20, 20, Math.round((255 * hits) / samples ** 2)], pixel * 4);
  }

  return { width: size, height: size, channels: 4, depth: 8, data };
};

describe("the edge diff", () => {
  // B-007 (memory 66ca3062), first: pinned to 0.7.0's numbers, so a constant or a pairing that moves moves these.
  it("reads a curved icon antialiased another way as the same edges, 13 rows and 8 columns, none off (B-007)", () => {
    expect(edges.of(bell(3, 0.5), bell(16, 0.5))).toEqual({
      rows: { matched: 13, shifted: [], missing: [], extra: [] },
      columns: { matched: 8, shifted: [], missing: [], extra: [] },
    });
  });

  it.each([
    ["a luminance step of 24 is no edge", { grey: 231 }, 0],
    ["a step of 25 is one", { grey: 230 }, 2],
    ["a line 4% of whose pixels step is an edge", { width: 100, length: 4 }, 2],
    ["one 3% of whose pixels step is not", { width: 100, length: 3 }, 0],
  ])("holds its thresholds (S-094): %s", (_case, bar, matched) => {
    const drawn = bars({ rows: [4], ...bar });

    expect(edges.of(drawn, drawn).rows.matched).toBe(matched);
  });

  it("pairs an edge moved 12 px as shifted by 12, and one moved 13 px as missing and extra (S-094)", () => {
    const reference = bars({ rows: [4], height: 40 });

    expect(edges.of(reference, bars({ rows: [16], height: 40 })).rows).toEqual({
      matched: 0,
      shifted: [
        { reference: 4, node: 16, by: 12 },
        { reference: 6, node: 18, by: 12 },
      ],
      missing: [],
      extra: [],
    });
    expect(edges.of(reference, bars({ rows: [17], height: 40 })).rows).toEqual({
      matched: 0,
      shifted: [],
      missing: [4, 6],
      extra: [17, 19],
    });
  });

  it("names at most 40 edges a list (S-094)", () => {
    const stripes = bars({ rows: Array.from({ length: 45 }, (_empty, index) => 2 + index * 4), height: 200 });

    expect(edges.of(stripes, bars({ rows: [], height: 200 })).rows.missing).toHaveLength(40);
  });
});

describe("image_compare's comparison", () => {
  it("finds no difference between an image and itself, nor between a transparent image and white (T-089)", () => {
    const drawn = bars({ rows: [4] });
    const clear: RgbaImage = { width: 20, height: 10, channels: 4, depth: 8, data: new Uint8Array(800) };

    expect(comparison.compare(drawn, drawn)).toMatchObject({
      rmse: 0,
      different: 0,
      box: null,
      rows: { matched: 2, shifted: [] },
    });
    expect(comparison.compare(clear, bars({ rows: [] }))).toMatchObject({ rmse: 0, different: 0, box: null });
  });

  it("counts a bar moved 2 px as 80 differing pixels in a 20 × 4 box, red in the difference (T-089)", () => {
    const { difference, ...result } = comparison.compare(bars({ rows: [6] }), bars({ rows: [4] }));
    const pixel = (x: number, y: number) => [...difference.data.subarray((y * 20 + x) * 4, (y * 20 + x) * 4 + 3)];

    expect(result).toMatchObject({
      different: 0.4,
      box: { x: 0, y: 4, width: 20, height: 4 },
      rows: {
        shifted: [
          { reference: 4, node: 6, by: 2 },
          { reference: 6, node: 8, by: 2 },
        ],
      },
    });
    expect(result.rmse).toBeGreaterThan(0);
    expect(pixel(0, 4)).toEqual([255, 0, 0]);
    expect(pixel(0, 0)).not.toEqual([255, 0, 0]);
  });

  // A§15.7: pixelmatch's count, recorded once as the new baseline; 0.7.0 (any channel off by more than 16) counted 20
  // of these 9216 pixels. The rmse is 0.7.0's.
  it("counts no pixel of a curved icon antialiased another way as different, its rmse 1.84 (A§15.7)", () => {
    expect(comparison.compare(bell(16, 0.5), bell(3, 0.5))).toMatchObject({ rmse: 1.84, different: 0, box: null });
  });

  it("compares the part both cover when the sizes differ, and an edge past it is missing (T-089)", () => {
    const result = comparison.compare(bars({ rows: [4] }), bars({ rows: [4, 25], height: 30 }));

    expect(result).toMatchObject({ rmse: 0, different: 0, rows: { matched: 2, missing: [25, 27], extra: [] } });
    expect(result.difference).toMatchObject({ width: 20, height: 10 });
  });
});
