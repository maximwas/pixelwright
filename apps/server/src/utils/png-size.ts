const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG's size from its IHDR chunk, which always comes first; null when the bytes are not a PNG. */
export function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const isPng =
    bytes.length >= 24 &&
    PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) &&
    String.fromCharCode(...bytes.subarray(12, 16)) === "IHDR";

  if (!isPng) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}
