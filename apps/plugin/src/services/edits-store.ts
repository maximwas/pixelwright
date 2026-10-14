import { EDITS_STORAGE_PREFIX, FILE_ID_KEY } from "../constants/plugin.ts";

/**
 * Allow edits as the user left it in this file, on this computer: figma.clientStorage is the user's own and shared by
 * every file, so each file has its own key, by its id. The id is Figma's file key where Figma gives one (private
 * plugins), else one Pixelwright keeps in the file's plugin data, written the first time Allow edits is turned on
 * there: a file that is only read stays as it was, and a copy of an allowed file carries the id along.
 */
export class EditsStore {
  #saving: Promise<void> = Promise.resolve();

  async read(): Promise<boolean> {
    const id = this.#fileId();

    return id !== null && typeof (await figma.clientStorage.getAsync(`${EDITS_STORAGE_PREFIX}${id}`)) === "string";
  }

  /** Keeps the switch for this file: on stores when it was turned on, off forgets it. One save at a time, in order. */
  save(allowed: boolean): Promise<void> {
    const saved = this.#saving.then(() => this.#save(allowed));

    // A failed save is its caller's; the next one still runs.
    this.#saving = saved.catch(() => {});

    return saved;
  }

  async #save(allowed: boolean): Promise<void> {
    if (allowed) {
      await figma.clientStorage.setAsync(
        `${EDITS_STORAGE_PREFIX}${this.#fileId() ?? this.#newFileId()}`,
        new Date().toISOString(),
      );

      return;
    }

    const id = this.#fileId();

    if (id !== null) {
      await figma.clientStorage.deleteAsync(`${EDITS_STORAGE_PREFIX}${id}`);
    }
  }

  #fileId(): string | null {
    const kept = figma.root.getPluginData(FILE_ID_KEY);

    return figma.fileKey ?? (kept === "" ? null : kept);
  }

  /** An id for this file, kept in it. Unique, not secret: the main thread's sandbox promises no crypto. */
  #newFileId(): string {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

    figma.root.setPluginData(FILE_ID_KEY, id);

    return id;
  }
}
