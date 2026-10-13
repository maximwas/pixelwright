import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import encode, { init } from "@jsquash/webp/encode.js";
import { decode } from "fast-png";
import { toRgba } from "../utils/rgba.ts";

/** A wasm module using SIMD, as wasm-feature-detect tests it (the encoder picks its build by the same test). */
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

let ready: Promise<unknown> | null = null;

/** The encoder's wasm, read from its package once: Node cannot fetch it the way a browser would. */
function loaded(): Promise<unknown> {
  ready ??= (async () => {
    const build = WebAssembly.validate(SIMD_PROBE) ? "webp_enc_simd" : "webp_enc";
    const path = createRequire(import.meta.url).resolve(`@jsquash/webp/codec/enc/${build}.wasm`);

    return init(await WebAssembly.compile(await readFile(path)));
  })();

  return ready;
}

/** A PNG as WebP at this quality (1–100), its transparency kept. */
export async function pngToWebp(png: Uint8Array, quality: number): Promise<Buffer> {
  await loaded();

  const image = toRgba(decode(png));
  const webp = await encode(
    {
      data: new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.byteLength),
      width: image.width,
      height: image.height,
      colorSpace: "srgb",
    } as Parameters<typeof encode>[0],
    { quality },
  );

  return Buffer.from(webp);
}
