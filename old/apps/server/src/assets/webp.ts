import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import encode, { init } from "@jsquash/webp/encode.js";
import { decode } from "fast-png";
import { toRgba } from "../utils/rgba.ts";

/** A wasm module using SIMD, as wasm-feature-detect tests it (the encoder picks its build by the same test). */
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

/** Encodes PNGs as WebP, its wasm read from the package once, when first needed: Node cannot fetch it as a browser. */
export class WebpEncoder {
  #ready: Promise<unknown> | null = null;

  /** A PNG as WebP at this quality (1–100), its transparency kept. */
  async encode(png: Uint8Array, quality: number): Promise<Buffer> {
    await this.#loaded();

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

  #loaded(): Promise<unknown> {
    this.#ready ??= (async () => {
      const build = WebAssembly.validate(SIMD_PROBE) ? "webp_enc_simd" : "webp_enc";
      const path = createRequire(import.meta.url).resolve(`@jsquash/webp/codec/enc/${build}.wasm`);

      return init(await WebAssembly.compile(await readFile(path)));
    })().catch((error: unknown) => {
      // Forgotten, so the next export tries again.
      this.#ready = null;

      throw error;
    });

    return this.#ready;
  }
}
