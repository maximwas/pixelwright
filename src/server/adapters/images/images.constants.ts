/** @jsquash/webp's wasm builds and the colour space its encoder takes (S-095). */
export const WEBP = {
  /** A wasm module using SIMD, as wasm-feature-detect tests it: the encoder picks its build by the same test. */
  simdProbe: [
    0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
  ],
  simdBuild: "webp_enc_simd",
  plainBuild: "webp_enc",
  wasmPath: (build: string) => `@jsquash/webp/codec/enc/${build}.wasm`,
  /** The server's lib (ES2024 and Node's types) declares no WebAssembly global, though Node has one. */
  wasmGlobal: "WebAssembly",
  colorSpace: "srgb",
} as const;

/**
 * pixelmatch's options (A§15.7): its own threshold, the render faded to 30% in the difference as 0.7.0 faded it, both
 * images laid over white rather than a checkerboard; `red` is its colour for a differing pixel, which no faded pixel
 * (always grey) and no antialiased one (yellow) has.
 */
export const PIXELMATCH = { options: { threshold: 0.1, alpha: 0.3, checkerboard: false }, red: [0xff, 0, 0] } as const;
