import { InjectionToken, inject, injectable } from "@needle-di/core";
import semver from "semver";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { JSON_FILE } from "@/core/ports/json-file.port.ts";
import { PACKAGE_REGISTRY } from "@/core/ports/package-registry.port.ts";
import { UPDATE_CHECK_INTERVAL_MS } from "@/server/app/stores/stores.constants.ts";
import { KeptLatestSchema, type Latest } from "@/server/app/stores/stores.schema.ts";

/**
 * The update banner's state (S-070), in latest.json so every session shares it: npm is asked at most once a day per
 * computer, never while the check is off (PIXELWRIGHT_NO_UPDATE_CHECK), and an answer that does not come keeps the
 * last one quietly. A version shows only while it is newer than this server and than the one dismissed.
 */
@injectable()
export class UpdateState {
  readonly #files;
  readonly #clock;
  readonly #registry;
  readonly #settings;

  constructor(
    files = inject(JSON_FILE),
    clock = inject(CLOCK),
    registry = inject(PACKAGE_REGISTRY),
    settings = inject(UPDATE_SETTINGS),
  ) {
    this.#files = files;
    this.#clock = clock;
    this.#registry = registry;
    this.#settings = settings;
  }

  /** The version the banner shows, or null. */
  async shown(): Promise<string | null> {
    if (!this.#settings.enabled) {
      return null;
    }

    const kept = this.#kept();
    const fresh = kept !== null && this.#clock.now() - kept.checkedAt < UPDATE_CHECK_INTERVAL_MS;
    const latest = fresh ? kept.version : await this.#ask(kept);
    const dismissed = kept?.dismissed;
    const shows =
      latest !== null &&
      this.#newer(latest, this.#settings.running) &&
      (dismissed === undefined || this.#newer(latest, dismissed));

    return shows ? latest : null;
  }

  /** The user closed the banner for `version`: it comes back only with a newer one. */
  dismiss(version: string): void {
    const kept = this.#kept();

    this.#keep({ version: kept?.version ?? version, checkedAt: kept?.checkedAt ?? 0, dismissed: version });
  }

  /** npm's answer, kept for every session; the last kept one when npm does not answer. */
  async #ask(kept: Latest | null): Promise<string | null> {
    const asked = await this.#registry.latest();

    if (asked === null) {
      return kept?.version ?? null;
    }

    this.#keep({ ...kept, version: asked, checkedAt: this.#clock.now() });

    return asked;
  }

  #kept(): Latest | null {
    return this.#files.read(this.#settings.file, KeptLatestSchema, null);
  }

  #keep(latest: Latest): void {
    try {
      this.#files.write(this.#settings.file, latest);
    } catch {
      // A home it cannot write only means npm is asked again next time.
    }
  }

  /** Whether `version` is newer than `than`; a version that is not semver never is. */
  #newer(version: string, than: string): boolean {
    return semver.valid(version) !== null && semver.valid(than) !== null && semver.gt(version, than);
  }
}

export const UPDATE_STATE = new InjectionToken<UpdateState>("UpdateState");

export const UPDATE_SETTINGS = new InjectionToken<UpdateSettings>("UpdateSettings");

/** latest.json's path, whether npm may be asked, and the running version a newer one is measured against. */
export interface UpdateSettings {
  readonly file: string;
  readonly enabled: boolean;
  readonly running: string;
}
