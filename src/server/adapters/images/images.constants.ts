/** @jsquash/webp's wasm builds and the pixels its encoder takes (S-095). */
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
  /** The encoder takes RGBA at 8 bits a channel: grey is spread to RGB, 16-bit channels keep their high byte. */
  rgba: 4,
  rgb: 3,
  depth: 8,
} as const;
