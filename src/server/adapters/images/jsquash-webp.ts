import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import encode, { init } from "@jsquash/webp/encode.js";
import { inject, injectable } from "@needle-di/core";
import { PIXEL } from "@/core/images/images.constants.ts";
import { IMAGE_CODEC, type PixelImage } from "@/core/ports/image-codec.port.ts";
import type { WebpEncoder } from "@/core/ports/webp-encoder.port.ts";
import { WEBP } from "@/server/adapters/images/images.constants.ts";

/** What the encoder's load needs of Node's WebAssembly. */
interface Wasm {
  validate(bytes: Uint8Array<ArrayBuffer>): boolean;
  compile(bytes: Uint8Array<ArrayBuffer>): Promise<object>;
}

/** Pixels as the encoder takes them. */
interface RgbaPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * PNGs as WebP through @jsquash/webp 1.5.0 (S-095, A§15.4: libwebp in wasm, nothing native to install under npx).
 * Node cannot fetch the wasm as a browser would, so it is read from the package once, when first needed, in the build
 * the encoder picks; a load that fails is forgotten, so the next export tries again.
 */
@injectable()
export class JsquashWebp implements WebpEncoder {
  readonly #codec;
  #ready: Promise<unknown> | null = null;

  constructor(codec = inject(IMAGE_CODEC)) {
    this.#codec = codec;
  }

  async encode(png: Uint8Array, quality: number): Promise<Uint8Array> {
    await this.#loaded();

    const { width, height, data } = this.#rgba(this.#codec.decode(png));
    const webp = await encode({ data, width, height, colorSpace: WEBP.colorSpace } as Parameters<typeof encode>[0], {
      quality,
    });

    return new Uint8Array(webp);
  }

  #loaded(): Promise<unknown> {
    this.#ready ??= this.#load().catch((error: unknown) => {
      this.#ready = null;

      throw error;
    });

    return this.#ready;
  }

  async #load(): Promise<unknown> {
    const wasm: Wasm = Reflect.get(globalThis, WEBP.wasmGlobal);
    const build = wasm.validate(Uint8Array.from(WEBP.simdProbe)) ? WEBP.simdBuild : WEBP.plainBuild;
    const path = createRequire(import.meta.url).resolve(WEBP.wasmPath(build));

    return init(await wasm.compile(await readFile(path)));
  }

  /** The image as 8-bit RGBA: grey spread to RGB, an opaque alpha added where it has none, 16 bits cut to 8. */
  #rgba({ width, height, channels, depth, data }: PixelImage): RgbaPixels {
    if (channels === WEBP.rgba && depth === WEBP.depth) {
      return { width, height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
    }

    const pixels = width * height;
    const rgba = new Uint8ClampedArray(pixels * WEBP.rgba);
    const shift = Math.max(0, depth - WEBP.depth);
    const colour = channels >= WEBP.rgb;
    const alpha = channels % 2 === 0;

    for (let pixel = 0; pixel < pixels; pixel++) {
      const from = pixel * channels;
      const to = pixel * WEBP.rgba;

      for (let channel = 0; channel < WEBP.rgb; channel++) {
        rgba[to + channel] = (data[from + (colour ? channel : 0)] ?? 0) >> shift;
      }

      rgba[to + WEBP.rgb] = alpha ? (data[from + channels - 1] ?? 0) >> shift : PIXEL.opaque;
    }

    return { width, height, data: rgba };
  }
}
