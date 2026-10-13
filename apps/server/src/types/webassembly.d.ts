/** The part of WebAssembly the WebP encoder needs: Node has the global, the ES2024 lib leaves it out. */
declare namespace WebAssembly {
  // biome-ignore lint/suspicious/noEmptyInterface: an opaque compiled module, only handed on to the encoder.
  interface Module {}

  function validate(bytes: Uint8Array): boolean;
  function compile(bytes: Uint8Array): Promise<Module>;
}
