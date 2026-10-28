import { inject, injectable } from "@needle-di/core";
import type { EditsSwitch } from "@/core/ports/edits-switch.port.ts";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store.port.ts";
import { FILE_ID } from "@/plugin/adapters/host/storage/file-id.ts";
import { EDITS_KEY } from "@/plugin/adapters/host/storage/storage.constants.ts";

/**
 * Allow edits remembered per file (P-011, R-003, m:1c91ea39): in clientStorage under the file's id, off unless stored
 * on. The value of this run is kept, so a save Figma refuses (a view-only file) holds for this run only; saves go one
 * after another.
 */
@injectable()
export class EditsStore implements EditsSwitch {
  readonly #store;
  readonly #files;
  #on: boolean | null = null;
  #saving: Promise<void> = Promise.resolve();

  constructor(store = inject(KEY_VALUE_STORE), files = inject(FILE_ID)) {
    this.#store = store;
    this.#files = files;
  }

  async isOn(): Promise<boolean> {
    if (this.#on === null) {
      const id = this.#files.read();
      const stored = id === null ? false : await this.#store.get(EDITS_KEY.of(id)).catch(() => false);

      this.#on ??= typeof stored === "boolean" && stored;
    }

    return this.#on;
  }

  set(on: boolean): Promise<void> {
    this.#on = on;
    this.#saving = this.#saving.then(() => this.#save(on));

    return this.#saving;
  }

  /** Off writes no id into a file that has none; a failed save is swallowed, the switch holds for this run. */
  async #save(on: boolean): Promise<void> {
    try {
      const id = on ? this.#files.ensure() : this.#files.read();

      if (id !== null) {
        await this.#store.set(EDITS_KEY.of(id), on);
      }
    } catch {
      // A view-only file refuses plugin data: the switch holds for this run only (D-49).
    }
  }
}
