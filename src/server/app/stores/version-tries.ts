import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { STORES_TEXT, VERSION_REPEAT } from "@/server/app/stores/stores.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * The version titles tried lately, by file (T-181): the same title in the same file within ten minutes is refused, as
 * a version cannot be deleted. A try is claimed (checked and noted in one synchronous step) before Figma is asked; a clear refusal forgets it, a timeout keeps it
 * (the version may be saved). One set per server, by plugin session: file keys are null.
 */
@injectable()
export class VersionTries {
  readonly #tried = new Map<string, number>();
  readonly #clock;

  constructor(clock = inject(CLOCK)) {
    this.#clock = clock;
  }

  /**
   * Refuses the title when it was tried in this file within the window, saying how long ago; else notes the try and
   * returns the noted moment as ISO text (the stamp of the version asked for).
   */
  claim(file: string, title: string): string {
    const now = this.#clock.now();
    const at = this.#tried.get(VERSION_REPEAT.key(file, title));
    const ago = at === undefined ? Number.POSITIVE_INFINITY : now - at;

    if (ago < VERSION_REPEAT.repeatMs) {
      const minutes = Math.max(1, Math.round(ago / VERSION_REPEAT.minuteMs));

      throw new PixelwrightError(ERROR_CODE.opFailed, STORES_TEXT.repeated(title, minutes));
    }

    this.#tried.set(VERSION_REPEAT.key(file, title), now);

    return new Date(now).toISOString();
  }

  forget(file: string, title: string): void {
    this.#tried.delete(VERSION_REPEAT.key(file, title));
  }
}

export const VERSION_TRIES = new InjectionToken<VersionTries>("VersionTries");
