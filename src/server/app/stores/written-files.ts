import { InjectionToken, inject, injectable } from "@needle-di/core";
import { JSON_FILE } from "@/core/ports/json-file.port.ts";
import { WRITTEN_STORE } from "@/server/app/stores/stores.constants.ts";
import { WrittenFilesSchema } from "@/server/app/stores/stores.schema.ts";

/** A file design_read or assets_export wrote: its bytes' SHA-1 and the layer it shows. */
interface WrittenFile {
  readonly sha1: string;
  readonly node: string;
}

/**
 * The files design_read and assets_export wrote (S-101), by their bytes: renders of layers rather than the images in
 * them, so design_apply can leave a layer be when its own render comes back, wherever the file went. Kept in
 * written-files.json in the channel's home and read again on every call, since other sessions write it too; the newest
 * 5000, the oldest dropped.
 */
@injectable()
export class WrittenFiles {
  readonly #files;
  readonly #path;

  constructor(files = inject(JSON_FILE), path = inject(WRITTEN_FILES_PATH)) {
    this.#files = files;
    this.#path = path;
  }

  /** The layers each file shows, by its SHA-1, the oldest first. */
  read(): ReadonlyMap<string, readonly string[]> {
    const empty = { version: WRITTEN_STORE.version, files: {} };

    return new Map(Object.entries(this.#files.read(this.#path, WrittenFilesSchema, empty).files));
  }

  /** Remembers the files as their layers', each moved to the newest. */
  add(written: readonly WrittenFile[]): void {
    if (written.length === 0) {
      return;
    }

    const files = new Map(this.read());

    for (const { sha1, node } of written) {
      const nodes = files.get(sha1) ?? [];

      files.delete(sha1);
      files.set(sha1, nodes.includes(node) ? nodes : [...nodes, node]);
    }

    this.#files.write(this.#path, {
      version: WRITTEN_STORE.version,
      files: Object.fromEntries([...files].slice(-WRITTEN_STORE.limit)),
    });
  }
}

export const WRITTEN_FILES = new InjectionToken<WrittenFiles>("WrittenFiles");

/** written-files.json's path, in the channel's home. */
export const WRITTEN_FILES_PATH = new InjectionToken<string>("WrittenFilesPath");
