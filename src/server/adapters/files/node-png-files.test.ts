import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { expect, it } from "vitest";
import { NodePngFiles } from "@/server/adapters/files/node-png-files.ts";
import { ImageSizeSniffer } from "@/server/adapters/images/image-size-sniffer.ts";

const PNG = encode({ width: 2, height: 1, channels: 4, data: new Uint8Array(8) });

/** A JPEG's first bytes: what a photo saved as photo.png holds. */
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

// T-072, D-14: a read-only tool never destroys a user's file: only .png paths, never over bytes that are not a PNG.
it("refuses a path that is not .png and a .png path holding JPEG bytes, and replaces an earlier screenshot", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pixelwright-png-"));
  const files = new NodePngFiles(new ImageSizeSniffer());
  const photo = join(folder, "photo.png");
  const shot = join(folder, "shots", "shot.png");

  await writeFile(photo, JPEG);

  await expect(files.write(join(folder, "shot.txt"), PNG)).rejects.toThrow(/save must be a \.png path, not/);
  await expect(files.write(photo, PNG)).rejects.toThrow(/photo\.png exists and is not a PNG/);
  expect(new Uint8Array(await readFile(photo))).toEqual(JPEG);

  await files.write(shot, PNG);
  await files.write(shot, PNG);
  expect(new Uint8Array(await readFile(shot))).toEqual(PNG);
});
