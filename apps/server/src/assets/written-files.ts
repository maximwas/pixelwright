import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homeDir } from "../bridge/bridge-config.ts";
import { WRITTEN_FILES_LIMIT } from "../constants/mcp.ts";
import { WrittenFilesFileSchema } from "../schemas/assets.ts";

/** A file design_read or assets_export wrote: its bytes' SHA-1 and the layer it shows. */
export interface WrittenFile {
  readonly sha1: string;
  readonly node: string;
}

/**
 * The files design_read and assets_export wrote, by their bytes: renders of layers rather than the images inside them,
 * so design_apply leaves a layer be when it comes back with its own render, wherever the file went.
 */
export interface WrittenFiles {
  /** The layers each file shows, by its SHA-1. */
  read(): Promise<ReadonlyMap<string, readonly string[]>>;
  add(files: readonly WrittenFile[]): Promise<void>;
}

/** Remembered while the process runs. */
export function memoryFiles(): WrittenFiles {
  const files = new Map<string, string[]>();

  return {
    read: async () => files,
    add: async (written) => {
      merge(files, written);
    },
  };
}

/**
 * Kept in written-files.json in the home dir, so a file another session's design_read wrote counts too; read again on
 * every call, as other pixelwright processes write it as well.
 */
export function fileStore(path = join(homeDir(), "written-files.json")): WrittenFiles {
  const load = async () => {
    try {
      const parsed = WrittenFilesFileSchema.safeParse(JSON.parse(await readFile(path, "utf8")));

      return new Map(parsed.success ? Object.entries(parsed.data.files) : []);
    } catch {
      return new Map<string, string[]>();
    }
  };

  return {
    read: load,
    add: async (written) => {
      if (written.length === 0) {
        return;
      }

      const files = await load();

      merge(files, written);

      // Written whole and then renamed: a process reading it meanwhile sees the old file or the new one, never half.
      const temporary = `${path}.${process.pid}.tmp`;

      await mkdir(dirname(path), { recursive: true });
      await writeFile(
        temporary,
        JSON.stringify({
          version: 1,
          files: Object.fromEntries([...files].slice(-WRITTEN_FILES_LIMIT)),
        }),
      );
      await rename(temporary, path);
    },
  };
}

/** The newest last, so the oldest are the ones dropped past the limit. */
function merge(files: Map<string, string[]>, written: readonly WrittenFile[]): void {
  for (const { sha1, node } of written) {
    const nodes = files.get(sha1) ?? [];

    files.delete(sha1);
    files.set(sha1, nodes.includes(node) ? nodes : [...nodes, node]);
  }
}
