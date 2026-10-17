import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { NPM_LATEST_URL, UPDATE_CHECK_INTERVAL_MS, UPDATE_CHECK_TIMEOUT_MS } from "../constants/updates.ts";
import { NpmLatestSchema, UpdateStateSchema } from "../schemas/updates.ts";
import type { LatestVersionOptions } from "../types/updates.ts";

/**
 * The newest Pixelwright on npm, for the plugin window's update banner: npm is asked at most once a day on the
 * computer (its answer kept in latest.json for every session), never while PIXELWRIGHT_NO_UPDATE_CHECK is set, and an
 * answer that does not come keeps the last one quietly.
 */
export class LatestVersion {
  readonly #options: LatestVersionOptions;
  readonly #now: () => number;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: LatestVersionOptions) {
    this.#options = options;
    this.#now = options.now ?? Date.now;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  /** The newest version: the kept answer while it is under a day old, else npm's; null when neither is known. */
  async check(): Promise<string | null> {
    if (!this.#options.enabled) {
      return null;
    }

    const kept = await this.#kept();

    if (kept !== null && this.#now() - kept.at < UPDATE_CHECK_INTERVAL_MS) {
      return kept.version;
    }

    const asked = await this.#ask();

    if (asked === null) {
      return kept?.version ?? null;
    }

    await this.#keep(asked);

    return asked;
  }

  async #ask(): Promise<string | null> {
    try {
      const response = await this.#fetch(NPM_LATEST_URL, { signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS) });

      return response.ok ? NpmLatestSchema.parse(await response.json()).version : null;
    } catch {
      return null;
    }
  }

  async #kept(): Promise<{ version: string; at: number } | null> {
    try {
      const state = UpdateStateSchema.parse(JSON.parse(await readFile(this.#options.file, "utf8")));
      const at = Date.parse(state.checkedAt);

      return Number.isNaN(at)
        ? null
        : {
            version: state.version,
            at,
          };
    } catch {
      return null;
    }
  }

  async #keep(version: string): Promise<void> {
    try {
      await mkdir(dirname(this.#options.file), { recursive: true });
      await writeFileAtomic(
        this.#options.file,
        `${JSON.stringify({
          version,
          checkedAt: new Date(this.#now()).toISOString(),
        })}\n`,
      );
    } catch {
      // A folder it cannot write only means npm is asked again next time.
    }
  }
}
