import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import decode, { init } from "@jsquash/webp/decode.js";
import { encode } from "fast-png";
import { beforeAll, describe, expect, it } from "vitest";
import { WebpEncoder } from "../src/assets/webp.ts";

const SIDE = 16;

/** Every fourth pixel fully transparent, every fourth opaque, the rest partly transparent, in many colours. */
const PIXELS = Uint8Array.from({ length: SIDE * SIDE * 4 }, (_, index) => {
  const pixel = Math.floor(index / 4);
  const alpha = [0, 255, (pixel * 5) % 256, (pixel * 11) % 256][pixel % 4] ?? 0;

  return [(pixel * 7) % 256, (pixel * 13) % 256, 200, alpha][index % 4] ?? 0;
});

const alphaOf = (data: ArrayLike<number>) => Array.from({ length: SIDE * SIDE }, (_, pixel) => data[pixel * 4 + 3]);

beforeAll(async () => {
  // Node cannot fetch the decoder's wasm as a browser would: it is read from the package, as the encoder's is.
  const wasm = createRequire(import.meta.url).resolve("@jsquash/webp/codec/dec/webp_dec.wasm");

  await init(await WebAssembly.compile(await readFile(wasm)));
});

describe("WebP encoding", () => {
  it.each([1, 85, 100])("keeps a transparent PNG's alpha exactly at quality %i", async (quality) => {
    const png = encode({
      width: SIDE,
      height: SIDE,
      channels: 4,
      data: PIXELS,
    });
    const webp = await new WebpEncoder().encode(png, quality);
    const back = await decode(Uint8Array.from(webp).buffer);

    expect([back.width, back.height]).toEqual([SIDE, SIDE]);
    expect(alphaOf(back.data)).toEqual(alphaOf(PIXELS));
  });
});
