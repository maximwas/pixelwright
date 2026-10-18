import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { slug } from "@pixelwright/core";
import writeFileAtomic from "write-file-atomic";
import type * as z from "zod";
import { homeDir } from "../../bridge/bridge-config.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { LIBRARIES_DIR } from "./constants.ts";
import { LibraryFileSchema } from "./schemas.ts";

export type LibraryFile = z.output<typeof LibraryFileSchema>;

/** A saved catalogue and where it lives. */
export interface StoredLibrary {
  readonly path: string;
  readonly library: LibraryFile;
}

/** Where catalogues live: ~/.pixelwright/libraries, or PIXELWRIGHT_HOME's. */
export function librariesFolder(): string {
  return join(homeDir(), LIBRARIES_DIR);
}

/**
 * Writes a library's catalogue whole, under its file's name.
 * shortcut: two library files with one name share a catalogue; key it by figma.fileKey once public plugins get one.
 */
export async function writeLibrary(folder: string, library: LibraryFile): Promise<string> {
  const path = join(folder, `${slug(library.name)}.json`);

  await mkdir(folder, { recursive: true });
  await writeFileAtomic(path, `${JSON.stringify(library)}\n`);

  return path;
}

/** Every saved catalogue by name, and why each one that cannot be read is left out. */
export async function readLibraries(folder: string): Promise<{ libraries: StoredLibrary[]; problems: string[] }> {
  const names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const libraries: StoredLibrary[] = [];
  const problems: string[] = [];

  for (const name of names) {
    const path = join(folder, name);

    try {
      libraries.push({
        path,
        library: LibraryFileSchema.parse(JSON.parse(await readFile(path, "utf8"))),
      });
    } catch (error) {
      problems.push(`${path} cannot be read, so its library is not searched: ${errorMessage(error)}`);
    }
  }

  return {
    libraries,
    problems,
  };
}
