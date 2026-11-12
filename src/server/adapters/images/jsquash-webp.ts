import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import encode, { init } from "@jsquash/webp/encode.js";
import { inject, injectable } from "@needle-di/core";
import { RGBA } from "@/core/images/rgba.ts";
import { IMAGE_CODEC } from "@/core/ports/image-codec.port.ts";
import type { WebpEncoder } from "@/core/ports/webp-encoder.port.ts";
import { WEBP } from "@/server/adapters/images/images.constants.ts";

/** What the encoder's load needs of Node's WebAssembly. */
interface Wasm {
  validate(bytes: Uint8Array<ArrayBuffer>): boolean;
  compile(bytes: Uint8Array<ArrayBuffer>): Promise<object>;
}

/**
 * PNGs as WebP through @jsquash/webp 1.5.0 (S-095, A§15.4: libwebp in wasm, nothing native to install under npx).
 * Node cannot fetch the wasm as a browser would, so it is read from the package once, when first needed, in the build
 * the encoder picks; a load that fails is forgotten, so the next export tries again. The encoder takes 8-bit RGBA.
 */
@injectable()
export class JsquashWebp implements WebpEncoder {
  readonly #codec;
  readonly #rgba;
  #ready: Promise<unknown> | null = null;

  constructor(codec = inject(IMAGE_CODEC), rgba = inject(RGBA)) {
    this.#codec = codec;
    this.#rgba = rgba;
  }

  async encode(png: Uint8Array, quality: number): Promise<Uint8Array> {
    await this.#loaded();

    const { width, height, data } = this.#rgba.of(this.#codec.decode(png));
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const webp = await encode(
      { data: pixels, width, height, colorSpace: WEBP.colorSpace } as Parameters<typeof encode>[0],
      { quality },
    );

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
}
