import { crc32, deflateSync } from "node:zlib";
import { decode } from "fast-png";
import { describe, expect, it } from "vitest";
import { toRgba } from "../src/utils/rgba.ts";

/** A PNG built by hand, so its bit depth and colour type are what the test says. */
function png(width: number, height: number, depth: number, colorType: number, rows: number[][], palette?: number[]) {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    const tail = Buffer.alloc(4);

    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);

    return Buffer.concat([head, data, tail]);
  };
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(depth, 8);
  header.writeUInt8(colorType, 9);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    ...(palette === undefined ? [] : [chunk("PLTE", Buffer.from(palette))]),
    chunk("IDAT", deflateSync(Buffer.concat(rows.map((row) => Buffer.from([0, ...row]))))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pixels = (image: { data: Uint8Array }) => [...image.data].join(",");

describe("toRgba", () => {
  it("reads a 4-bit palette image pixel by pixel", () => {
    // Red, blue, red, blue: indexes 0 1 0 1, two to a byte.
    const image = toRgba(decode(png(4, 1, 4, 3, [[0x01, 0x01]], [255, 0, 0, 0, 0, 255])));

    expect(pixels(image)).toBe("255,0,0,255,0,0,255,255,255,0,0,255,0,0,255,255");
  });

  it("reads a 1-bit grey image pixel by pixel", () => {
    // Black, white, white, black: bits 0110.
    const image = toRgba(decode(png(4, 1, 1, 0, [[0b0110_0000]])));

    expect(pixels(image)).toBe("0,0,0,255,255,255,255,255,255,255,255,255,0,0,0,255");
  });
});
