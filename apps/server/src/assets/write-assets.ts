import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { PlannedAsset } from "@pixelwright/core";

/** A file design_read wrote, or the one it reused for the same bytes. */
export interface WrittenAsset {
  readonly node: string;
  readonly kind: PlannedAsset["kind"];
  readonly src: string;
  readonly bytes: number;
}

/** The key designXml looks an asset's final path up by: the layer, and the image hash for a background. */
export function assetKey(asset: Pick<PlannedAsset, "node" | "imageHash">): string {
  return asset.imageHash === undefined ? asset.node : `${asset.node}#${asset.imageHash}`;
}

/**
 * Fetches and writes the planned assets into `dir`: the same bytes once (a second layer gets the first file's path),
 * an original image with the extension of what it really is (Figma keeps JPEG, GIF and WebP as placed).
 */
export async function writeAssets(
  assets: readonly PlannedAsset[],
  fetch: (asset: PlannedAsset) => Promise<Buffer>,
  dir: string,
  srcBase: string,
): Promise<{ srcByKey: Map<string, string>; written: WrittenAsset[] }> {
  const srcByKey = new Map<string, string>();
  const written: WrittenAsset[] = [];
  const byDigest = new Map<string, string>();
  const names = new Set<string>();
  const base = srcBase.replace(/\/+$/, "");

  await mkdir(dir, { recursive: true });

  for (const asset of assets) {
    const bytes = await fetch(asset);
    const digest = createHash("sha256").update(bytes).digest("hex");
    let src = byDigest.get(digest);

    if (src === undefined) {
      const name = uniqueName(
        withExtension(basename(asset.src), asset.imageHash === undefined ? null : extensionOf(bytes)),
        names,
      );

      await writeFile(join(dir, name), bytes);
      src = `${base}/${name}`;
      byDigest.set(digest, src);
    }

    srcByKey.set(assetKey(asset), src);
    written.push({
      node: asset.node,
      kind: asset.kind,
      src,
      bytes: bytes.length,
    });
  }

  return {
    srcByKey,
    written,
  };
}

/** The format an image's bytes are in, by their signature. */
export function extensionOf(bytes: Buffer): string | null {
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return "png";
  }

  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "jpg";
  }

  if (bytes.subarray(0, 4).toString("latin1") === "GIF8") {
    return "gif";
  }

  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") {
    return "webp";
  }

  return null;
}

function withExtension(name: string, extension: string | null): string {
  return extension === null ? name : name.replace(/\.[^.]+$/, `.${extension}`);
}

/** A name not written yet in this read: `photo.jpg` after `photo.png` stays, a second `photo.png` becomes `photo-2.png`. */
function uniqueName(name: string, names: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const stem = dot === -1 ? name : name.slice(0, dot);
  const extension = dot === -1 ? "" : name.slice(dot);
  let candidate = name;

  for (let index = 2; names.has(candidate); index++) {
    candidate = `${stem}-${index}${extension}`;
  }

  names.add(candidate);

  return candidate;
}
