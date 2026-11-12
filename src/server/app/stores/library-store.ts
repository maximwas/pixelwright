import { readdirSync } from "node:fs";
import { join } from "node:path";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { SLUG } from "@/core/kernel/names/slug.ts";
import { JSON_FILE } from "@/core/ports/json-file.port.ts";
import { LIBRARY_FILES } from "@/server/app/stores/stores.constants.ts";
import { KeptLibrarySchema, type LibraryFile } from "@/server/app/stores/stores.schema.ts";

/** A saved catalogue and where it lives. */
export interface StoredLibrary {
  readonly path: string;
  readonly library: LibraryFile;
}

/** Every saved catalogue, and the paths of those that cannot be read. */
interface SavedLibraries {
  readonly libraries: StoredLibrary[];
  readonly unreadable: string[];
}

/**
 * The saved component libraries (T-193): one catalogue per library file in the libraries folder of the channel's home,
 * written whole in one step through the JsonFile port and read back through its schema; read again on every search,
 * since any session may save one.
 */
@injectable()
export class LibraryStore {
  readonly #files;
  readonly #folder;
  readonly #slug;

  constructor(
    files = inject(JSON_FILE),
    folder = inject(LIBRARIES_FOLDER),
    slug = inject(SLUG),
  ) {
    this.#files = files;
    this.#folder = folder;
    this.#slug = slug;
  }

  /**
   * Writes a library's catalogue under its file's name, replacing the one before; the path it went to.
   * shortcut: two library files with one name share a catalogue; key it by figma.fileKey once public plugins get one.
   */
  write(library: LibraryFile): string {
    const path = join(this.#folder, LIBRARY_FILES.file(this.#slug.of(library.name)));

    this.#files.write(path, library);

    return path;
  }

  read(): SavedLibraries {
    const libraries: StoredLibrary[] = [];
    const unreadable: string[] = [];

    for (const name of this.#names()) {
      const path = join(this.#folder, name);
      const library = this.#files.read(path, KeptLibrarySchema, null);

      if (library === null) {
        unreadable.push(path);
      } else {
        libraries.push({ path, library });
      }
    }

    return { libraries, unreadable };
  }

  /** The catalogues' file names in order; none until the first save makes the folder. */
  #names(): string[] {
    try {
      return readdirSync(this.#folder)
        .filter((name) => name.endsWith(LIBRARY_FILES.extension))
        .sort();
    } catch {
      return [];
    }
  }
}

export const LIBRARY_STORE = new InjectionToken<LibraryStore>("LibraryStore");

/** The libraries folder, in the channel's home. */
export const LIBRARIES_FOLDER = new InjectionToken<string>("LibrariesFolder");
