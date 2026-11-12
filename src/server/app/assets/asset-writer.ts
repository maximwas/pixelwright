import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { PlannedFile } from "@/core/design/assets/assets.types.ts";
import { IMAGE_SNIFFER } from "@/core/ports/image-sniffer.port.ts";
import { ASSET_DIGEST, ASSET_NUMBER, ASSETS_TEXT, ORIGINAL_EXTENSIONS } from "@/server/app/assets/assets.constants.ts";
import type { WrittenAsset } from "@/server/app/assets/assets.types.ts";
import { WRITTEN_FILES } from "@/server/app/stores/written-files.ts";

/** A planned asset and its bytes. */
export interface FetchedAsset {
  readonly asset: PlannedFile;
  readonly bytes: Uint8Array;
}

/** Where files go: the folder on disk, and dir as the caller gave it, which the paths name them by. */
export interface AssetPlace {
  readonly folder: string;
  readonly dir: string;
}

/**
 * Writes assets into a folder (T-195, S-100), each under its planned file name: the same bytes once, a later layer
 * getting the first file's path; a name is free when no file holds it or the file holds these very bytes, else `-2`,
 * `-3`, so a file an earlier read wrote, which code may import, is never overwritten; an original gets the extension
 * of what its bytes are. Each file is remembered as its layers' (S-101). Assets come one at a time, each written before
 * the next is asked for: only digests and names are kept (O-014).
 */
@injectable()
export class AssetWriter {
  readonly #sniffer;
  readonly #files;

  constructor(sniffer = inject(IMAGE_SNIFFER), files = inject(WRITTEN_FILES)) {
    this.#sniffer = sniffer;
    this.#files = files;
  }

  async write(fetched: AsyncIterable<FetchedAsset> | Iterable<FetchedAsset>,    { folder, dir }: AssetPlace): Promise<WrittenAsset[]> {
    const byDigest = new Map<string, string>();
    const taken = new Set<string>();
    const written: WrittenAsset[] = [];
    const stored: { readonly sha1: string; readonly node: string }[] = [];

    await mkdir(folder, { recursive: true });

    for await (const { asset, bytes } of fetched) {
      const digest = this.#digest(bytes, ASSET_DIGEST.same);
      const name = byDigest.get(digest) ?? (await this.#place(this.#named(asset, bytes), bytes, folder, taken));

      byDigest.set(digest, name);
      written.push({
        node: asset.node,
        kind: asset.kind,
        ...(asset.imageHash === undefined ? {} : { imageHash: asset.imageHash }),
        path: join(dir, name),
        planned: join(dir, basename(asset.src)),
        bytes: bytes.length,
      });
      stored.push({ sha1: this.#digest(bytes, ASSET_DIGEST.store), node: asset.node });
    }

    this.#files.add(stored);

    return written;
  }

  /** The planned file name; an original's extension as its bytes say (a photo.png plan holding a JPEG: photo.jpg). */
  #named({ src, imageHash }: PlannedFile, bytes: Uint8Array): string {
    const name = basename(src);
    const format = imageHash === undefined ? undefined : this.#sniffer.sniff(bytes)?.format;

    return format !== undefined && Object.hasOwn(ORIGINAL_EXTENSIONS, format)
      ? ASSETS_TEXT.named(basename(name, extname(name)), format)
      : name;
  }

  /** Writes the bytes under the first free name, numbered while one is taken in this write or holds other bytes. */
  async #place(
    name: string,
    bytes: Uint8Array,
    folder: string,
    taken: Set<string>,
  ): Promise<string> {
    const extension = extname(name);
    const stem = basename(name, extension);
    let candidate = name;

    for (
      let number: number = ASSET_NUMBER.first;
      taken.has(candidate) || !(await this.#free(join(folder, candidate), bytes));
      number++
    ) {
      candidate = ASSETS_TEXT.numbered(stem, number, extension);
    }

    taken.add(candidate);
    await writeFile(join(folder, candidate), bytes);

    return candidate;
  }

  /** No file at the path, or one holding these very bytes. */
  async #free(path: string, bytes: Uint8Array): Promise<boolean> {
    const existing = await readFile(path).catch(() => null);

    return existing === null || existing.equals(bytes);
  }

  #digest(bytes: Uint8Array, algorithm: string): string {
    return createHash(algorithm).update(bytes).digest(ASSET_DIGEST.encoding);
  }
}

export const ASSET_WRITER = new InjectionToken<AssetWriter>("AssetWriter");
