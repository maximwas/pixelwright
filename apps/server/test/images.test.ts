import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { imageInfo } from "../src/assets/image-info.ts";
import { blankPng, pixel } from "./helpers/images.ts";

describe("the PNGs the live check makes and reads", () => {
  it("makes a transparent PNG of any size", () => {
    const png = blankPng(4_100, 2);

    expect(imageInfo(png)).toEqual({
      format: "png",
      width: 4_100,
      height: 2,
    });
    expect(pixel(png, 4_099, 1)).toEqual([0, 0, 0, 0]);
  });

  it("reads one pixel of an RGBA or RGB PNG by column and row", () => {
    const rgba = encode({
      width: 2,
      height: 2,
      channels: 4,
      data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128]),
    });
    const rgb = encode({
      width: 2,
      height: 1,
      channels: 3,
      data: Uint8Array.from([1, 2, 3, 4, 5, 6]),
    });

    expect(pixel(rgba, 1, 0)).toEqual([0, 255, 0, 255]);
    expect(pixel(rgba, 1, 1)).toEqual([255, 255, 255, 128]);
    expect(pixel(rgb, 1, 0)).toEqual([4, 5, 6]);
  });
});
