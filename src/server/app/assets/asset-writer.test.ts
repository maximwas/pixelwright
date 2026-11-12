import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { PlannedFile } from "@/core/design/assets/assets.types.ts";
import type { ImageSniffer } from "@/core/ports/image-sniffer.port.ts";
import type { JsonFile } from "@/core/ports/json-file.port.ts";
import { AssetWriter } from "@/server/app/assets/asset-writer.ts";
import { WrittenFiles } from "@/server/app/stores/written-files.ts";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const OTHER_PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 2]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

/** PNG and JPEG told apart by their first byte, as image-size would (a server/app test does not import the adapters). */
const SNIFFER: ImageSniffer = {
  sniff: (bytes) =>
    bytes[0] === JPEG[0]
      ? { format: "jpg", width: 1, height: 1 }
      : bytes[0] === PNG[0]
        ? { format: "png", width: 1, height: 1 }
        : null,
};

/** The home's JSON files in memory. */
function home(): JsonFile {
  const stored = new Map<string, unknown>();

  return {
    read: (
      path,
      schema,
      fallback,
    ) => zod.parse(schema, stored.get(path) ?? fallback),
    write: (path, value) => void stored.set(path, JSON.parse(JSON.stringify(value))),
    ensure: () => undefined,
  };
}

const asset = (
  node: string,
  name: string,
  imageHash?: string,
): PlannedFile => ({
  node,
  kind: "image",
  format: "PNG",
  src: `assets/${name}`,
  ...(imageHash === undefined ? {} : { imageHash }),
});

describe("asset writer", () => {
  it("writes the same bytes once, gives a name holding other bytes -2 and never writes over it; writing again adds nothing (T-195, T-055)", async () => {
    const folder = await mkdtemp(join(tmpdir(), "pixelwright-assets-"));
    const files = new WrittenFiles(home(), "/home/written-files.json");
    const writer = new AssetWriter(SNIFFER, files);
    const fetched = [
      { asset: asset("1:1", "photo.png"), bytes: PNG },
      { asset: asset("1:2", "second.png"), bytes: PNG },
    ];

    await writeFile(join(folder, "photo.png"), OTHER_PNG);

    const first = await writer.write(fetched, { folder, dir: "assets" });

    expect(first.map(({ node, path, planned }) => [node, path, planned])).toEqual([
      ["1:1", "assets/photo-2.png", "assets/photo.png"],
      ["1:2", "assets/photo-2.png", "assets/second.png"],
    ]);
    expect(await readFile(join(folder, "photo.png"))).toEqual(Buffer.from(OTHER_PNG));

    const again = await writer.write(fetched, { folder, dir: "assets" });

    expect(again.map(({ path }) => path)).toEqual(["assets/photo-2.png", "assets/photo-2.png"]);
    expect((await readdir(folder)).sort()).toEqual(["photo-2.png", "photo.png"]);
    expect(files.read().get(createHash("sha1").update(PNG).digest("hex"))).toEqual(["1:1", "1:2"]);
  });

  it("gives an original image the extension of what its bytes are (T-195)", async () => {
    const folder = await mkdtemp(join(tmpdir(), "pixelwright-assets-"));
    const writer = new AssetWriter(SNIFFER, new WrittenFiles(home(), "/home/written-files.json"));
    const [written] = await writer.write(
      [{ asset: asset("1:5", "planet-background.png", "c".repeat(40)), bytes: JPEG }],
      { folder, dir: folder },
    );

    expect(written).toMatchObject({
      path: join(folder, "planet-background.jpg"),
      planned: join(folder, "planet-background.png"),
      bytes: JPEG.length,
    });
  });
});
