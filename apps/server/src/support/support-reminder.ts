import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { SUPPORT_REMINDER_INTERVAL_MS } from "../constants/support.ts";
import { SupportStateSchema } from "../schemas/support.ts";
import type { SupportNotes, SupportReminderOptions } from "../types/support.ts";
import { supportNote } from "../utils/support-note.ts";

/**
 * When the agent may mention how to support the project: only with links to show, only while the person allows it
 * (PIXELWRIGHT_SUPPORT_REMINDERS), and at most once a week on the computer. Tools ask only after a change that worked.
 */
export class SupportReminder implements SupportNotes {
  readonly #options: SupportReminderOptions;
  readonly #now: () => number;

  constructor(options: SupportReminderOptions) {
    this.#options = options;
    this.#now = options.now ?? Date.now;
  }

  /** The note to pass on now, which counts as given; or null. Never throws: the call it rides on worked. */
  async due(): Promise<string | null> {
    try {
      if (this.#options.links.length === 0 || !this.#options.enabled) {
        return null;
      }

      const last = await this.#lastShownAt();

      if (last !== null && this.#now() - last < SUPPORT_REMINDER_INTERVAL_MS) {
        return null;
      }

      await mkdir(dirname(this.#options.file), { recursive: true });
      await writeFileAtomic(
        this.#options.file,
        `${JSON.stringify({ lastShownAt: new Date(this.#now()).toISOString() })}\n`,
      );

      return supportNote(this.#options.links);
    } catch {
      return null;
    }
  }

  async #lastShownAt(): Promise<number | null> {
    try {
      const state = SupportStateSchema.parse(JSON.parse(await readFile(this.#options.file, "utf8")));
      const at = Date.parse(state.lastShownAt);

      return Number.isNaN(at) ? null : at;
    } catch {
      return null;
    }
  }
}
