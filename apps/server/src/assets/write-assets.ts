import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { PlannedAsset } from "@pixelwright/core";
import type { WrittenFiles } from "./written-files.ts";

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
 * an original image with the extension of what it really is (Figma keeps JPEG, GIF and WebP as placed). Each file is
 * remembered as its layers' in `files`, so design_apply knows it when it comes back.
 */
export async function writeAssets(
  assets: readonly PlannedAsset[],
  fetch: (asset: PlannedAsset) => Promise<Buffer>,
  dir: string,
  srcBase: string,
  files: WrittenFiles,
): Promise<{ srcByKey: Map<string, string>; written: WrittenAsset[] }> {
  const srcByKey = new Map<string, string>();
  const written: WrittenAsset[] = [];
  const byDigest = new Map<string, string>();
  const remembered: { sha1: string; node: string }[] = [];
  const names = new Set<string>();
  const base = srcBase.replace(/\/+$/, "");

  await mkdir(dir, { recursive: true });

  for (const asset of assets) {
    const bytes = await fetch(asset);
    const digest = createHash("sha256").update(bytes).digest("hex");
    let src = byDigest.get(digest);

    if (src === undefined) {
      const name = await freeName(
        withExtension(basename(asset.src), asset.imageHash === undefined ? null : extensionOf(bytes)),
        bytes,
        dir,
        names,
      );

      await writeFile(join(dir, name), bytes);
      src = `${base}/${name}`;
      byDigest.set(digest, src);
    }

    srcByKey.set(assetKey(asset), src);
    remembered.push({
      sha1: createHash("sha1").update(bytes).digest("hex"),
      node: asset.node,
    });
    written.push({
      node: asset.node,
      kind: asset.kind,
      src,
      bytes: bytes.length,
    });
  }

  await files.add(remembered);

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

/**
 * A name for these bytes: not used yet in this read, and either free in the folder or holding the same bytes already
 * (an earlier read's file is never overwritten: code may use it). `photo.jpg` after `photo.png` stays; a second,
 * different `photo.png` becomes `photo-2.png`.
 */
async function freeName(name: string, bytes: Buffer, dir: string, names: Set<string>): Promise<string> {
  const dot = name.lastIndexOf(".");
  const stem = dot === -1 ? name : name.slice(0, dot);
  const extension = dot === -1 ? "" : name.slice(dot);
  let candidate = name;

  for (let index = 2; names.has(candidate) || !(await holdsOrFree(join(dir, candidate), bytes)); index++) {
    candidate = `${stem}-${index}${extension}`;
  }

  names.add(candidate);

  return candidate;
}

async function holdsOrFree(path: string, bytes: Buffer): Promise<boolean> {
  try {
    return (await readFile(path)).equals(bytes);
  } catch {
    return true;
  }
}
