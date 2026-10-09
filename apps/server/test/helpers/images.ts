/** A real 1x1 PNG, JPEG and GIF, and a PNG's header of any size: what image readers need to see a real image. */
export const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63f8cfc0f01f0005000201" +
    "e1d7f0a50000000049454e44ae426082",
  "hex",
);

export const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

export const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** A PNG's signature and IHDR chunk for this size: enough for a reader of sizes, not a picture. */
export function pngHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(33);

  PNG.copy(header, 0, 0, 16);
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header.set([8, 6, 0, 0, 0], 24);

  return header;
}
