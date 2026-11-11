import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { JSON_FILE } from "@/core/ports/json-file.port.ts";
import { SUPPORT_STORE, SUPPORT_TEXT } from "@/server/app/stores/stores.constants.ts";
import { SupportStateSchema } from "@/server/app/stores/stores.schema.ts";

/**
 * The weekly support sentence (T-006, D-34): after a write that changed something, at most once in 7 days on this
 * computer (support.json in the home, whichever session gives it), never while PIXELWRIGHT_SUPPORT_REMINDERS is off.
 */
@injectable()
export class SupportNote {
  readonly #files;
  readonly #clock;
  readonly #settings;

  constructor(
    files = inject(JSON_FILE),
    clock = inject(CLOCK),
    settings = inject(SUPPORT_SETTINGS),
  ) {
    this.#files = files;
    this.#clock = clock;
    this.#settings = settings;
  }

  /** The sentence to pass on now, which counts as given; or null. Never throws: the call it rides on worked. */
  due(): string | null {
    if (!this.#settings.enabled) {
      return null;
    }

    const { lastShownAt } = this.#files.read(this.#settings.file, SupportStateSchema, { lastShownAt: null });
    const now = this.#clock.now();

    if (lastShownAt !== null && now - lastShownAt < SUPPORT_STORE.intervalMs) {
      return null;
    }

    try {
      this.#files.write(this.#settings.file, { lastShownAt: now });
    } catch {
      // A home it cannot write would give the sentence on every call: none rather than too many.
      return null;
    }

    return SUPPORT_TEXT.sentence();
  }
}

export const SUPPORT_NOTE = new InjectionToken<SupportNote>("SupportNote");

export const SUPPORT_SETTINGS = new InjectionToken<SupportSettings>("SupportSettings");

/** support.json's path, and whether the sentence is given at all. */
export interface SupportSettings {
  readonly file: string;
  readonly enabled: boolean;
}
