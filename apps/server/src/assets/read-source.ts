import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { MAX_SOURCE_BYTES, MAX_SVG_BYTES } from "../constants/mcp.ts";
import { extensionOf } from "./write-assets.ts";

/** A file design_apply writes from: its bytes and their SHA-1 (Figma's image hash). */
export interface SourceFile {
  readonly path: string;
  readonly bytes: Buffer;
  readonly sha1: string;
}

/**
 * A file named by src or a background's url(), relative to the server's folder as assets_export's dir is: null when
 * there is none, an error message when it is not what the layer needs (an image, or an SVG for an Icon).
 */
export async function readSource(
  path: string,
  cwd: string,
  kind: "image" | "icon",
): Promise<SourceFile | null | string> {
  const absolute = resolve(cwd, path);
  const info = await stat(absolute).catch(() => null);

  if (info === null || !info.isFile()) {
    return null;
  }

  const limit = kind === "icon" ? MAX_SVG_BYTES : MAX_SOURCE_BYTES;

  if (info.size > limit) {
    return `${path} is ${Math.round(info.size / 1024 / 1024)} MB: design_apply takes ${kind === "icon" ? "an SVG" : "an image"} of ${limit / 1024 / 1024} MB at most.`;
  }

  const bytes = await readFile(absolute);

  if (kind === "icon" ? !/<svg[\s>]/i.test(bytes.subarray(0, 4096).toString("utf8")) : extensionOf(bytes) === null) {
    return kind === "icon"
      ? `${path} is not an SVG: an <Icon> is drawn from an SVG file.`
      : `${path} is not a PNG, JPG, GIF or WebP image.`;
  }

  return {
    path: absolute,
    bytes,
    sha1: createHash("sha1").update(bytes).digest("hex"),
  };
}
