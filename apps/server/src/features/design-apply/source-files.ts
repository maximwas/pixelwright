import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { imageInfo } from "../../assets/image-info.ts";
import { MAX_SOURCE_BYTES, MAX_SVG_BYTES } from "./constants.ts";

/** What a file is read as: an image for an Image or a background, an SVG for an Icon. */
export type SourceKind = "image" | "icon";

/** A file design_apply writes from: its bytes and their SHA-1 (Figma's image hash). */
export interface SourceFile {
  readonly path: string;
  readonly bytes: Buffer;
  readonly sha1: string;
}

/** A file read for a layer: the file, or why there is none to use (none at that path, or not what the layer needs). */
export type SourceRead =
  | { readonly file: SourceFile }
  | { readonly problem: "missing" | "unusable"; readonly message: string };

/**
 * The files one design_apply call names by src or a background's url(), relative to the server's folder as
 * assets_export's dir is. Each is read once per kind, however many layers name it.
 */
export class SourceFiles {
  readonly #cwd: string;
  readonly #reads = new Map<string, Promise<SourceRead>>();

  constructor(cwd: string) {
    this.#cwd = cwd;
  }

  read(path: string, kind: SourceKind): Promise<SourceRead> {
    const key = `${kind} ${path}`;
    let read = this.#reads.get(key);

    if (read === undefined) {
      read = readSource(path, this.#cwd, kind);
      this.#reads.set(key, read);
    }

    return read;
  }
}

async function readSource(path: string, cwd: string, kind: SourceKind): Promise<SourceRead> {
  const absolute = resolve(cwd, path);
  const info = await stat(absolute).catch(() => null);

  if (info === null || !info.isFile()) {
    return {
      problem: "missing",
      message: `${path} is not a file the server can read (paths are from its folder: ${cwd}).`,
    };
  }

  const limit = kind === "icon" ? MAX_SVG_BYTES : MAX_SOURCE_BYTES;

  if (info.size > limit) {
    return unusable(
      `${path} is ${Math.round(info.size / 1024 / 1024)} MB: design_apply takes ${kind === "icon" ? "an SVG" : "an image"} of ${limit / 1024 / 1024} MB at most.`,
    );
  }

  const bytes = await readFile(absolute);

  if (kind === "icon" && !/<svg[\s>]/i.test(bytes.subarray(0, 4096).toString("utf8"))) {
    return unusable(`${path} is not an SVG: an <Icon> is drawn from an SVG file.`);
  }

  if (kind === "image" && imageInfo(bytes) === null) {
    return unusable(`${path} is not a PNG, JPG, GIF or WebP image.`);
  }

  return {
    file: {
      path: absolute,
      bytes,
      sha1: createHash("sha1").update(bytes).digest("hex"),
    },
  };
}

function unusable(message: string): SourceRead {
  return {
    problem: "unusable",
    message,
  };
}
