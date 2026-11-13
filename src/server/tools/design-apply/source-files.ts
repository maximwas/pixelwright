import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { IMAGE_SNIFFER, type SniffedImage } from "@/core/ports/image-sniffer.port.ts";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import {
  SOURCE_FORMAT,
  SOURCE_KIND,
  SOURCE_LIMIT,
  SOURCE_PROBLEM,
  SOURCE_TEXT,
  SOURCE_VALUE,
} from "@/server/tools/design-apply/design-apply.constants.ts";
import { UPLOAD } from "@/shared/ops/upload/upload.constants.ts";

/** What a file is read as: an image for an Image or a background, an SVG for an Icon. */
export type SourceKind = (typeof SOURCE_KIND)[keyof typeof SOURCE_KIND];

/** A file design_apply writes from: its bytes, their SHA-1 (Figma's image hash) and, for an image, its format and size. */
export interface SourceFile {
  readonly path: string;
  readonly bytes: Buffer;
  readonly sha1: string;
  readonly image: SniffedImage | null;
}

/** A file read for a layer: the file, or why there is none to use (none at that path, or not what the layer needs). */
export type SourceRead =
  | { readonly file: SourceFile; readonly problem?: undefined }
  | {
    readonly file?: undefined;
    readonly problem: (typeof SOURCE_PROBLEM)[keyof typeof SOURCE_PROBLEM];
    readonly message: string;
  };

/** One call's reads, by kind and path: each file is read once, however many layers name it. */
export type SourceReads = Map<string, Promise<SourceRead>>;

/**
 * The files a design_apply call names by src or a background's url() (T-131), a relative path from the project folder
 * as assets_export's dir is: an image of PNG, JPG, GIF or WebP up to 32 MB, an SVG up to 2 MB.
 */
@injectable()
export class SourceFiles {
  readonly #folder;
  readonly #sniffer;

  constructor(folder = inject(PROJECT_FOLDER), sniffer = inject(IMAGE_SNIFFER)) {
    this.#folder = folder;
    this.#sniffer = sniffer;
  }

  read(
    path: string,
    kind: SourceKind,
    reads: SourceReads,
  ): Promise<SourceRead> {
    const key = SOURCE_TEXT.key(kind, path);
    const held = reads.get(key);

    if (held !== undefined) {
      return held;
    }

    const read = this.#read(path, kind);

    reads.set(key, read);

    return read;
  }

  async #read(path: string, kind: SourceKind): Promise<SourceRead> {
    const full = await this.#folder.resolve(path);
    const info = await stat(full).catch(() => null);

    if (info === null || !info.isFile()) {
      const folder = isAbsolute(path) ? null : await this.#folder.root();

      return { problem: SOURCE_PROBLEM.missing, message: SOURCE_TEXT.notAFile(path, folder) };
    }

    const limit = kind === SOURCE_KIND.icon ? SOURCE_LIMIT.svgBytes : UPLOAD.maxBytes;

    if (info.size > limit) {
      return this.#unusable(SOURCE_TEXT.tooBig(path, info.size, kind, limit));
    }

    const bytes = await readFile(full);
    const image = kind === SOURCE_KIND.image ? this.#sniffer.sniff(bytes) : null;

    if (kind === SOURCE_KIND.icon && !SOURCE_VALUE.svg.test(bytes.subarray(0, SOURCE_LIMIT.svgSniffBytes).toString())) {
      return this.#unusable(SOURCE_TEXT.notSvg(path));
    }

    if (kind === SOURCE_KIND.image && !SOURCE_FORMAT.known.some((format) => format === image?.format)) {
      return this.#unusable(SOURCE_TEXT.notImage(path));
    }

    return {
      file: { path: full, bytes, sha1: createHash(SOURCE_VALUE.hash).update(bytes).digest(SOURCE_VALUE.hex), image },
    };
  }

  #unusable(message: string): SourceRead {
    return { problem: SOURCE_PROBLEM.unusable, message };
  }
}

export const SOURCE_FILES = new InjectionToken<SourceFiles>("SourceFiles");
