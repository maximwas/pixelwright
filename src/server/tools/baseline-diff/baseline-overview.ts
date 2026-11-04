import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { BASELINE_STORE } from "@/server/app/baselines/baseline-store.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import {
  BASELINE_COMPARE,
  type BaselineCompare,
  type Comparison,
} from "@/server/tools/baseline-diff/baseline-compare.ts";
import {
  BASELINE_DIFF_TEXT,
  BASELINE_STATUS,
  OVERVIEW_LIMIT,
} from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import type { BaselineDiffOutput, BaselineEntry } from "@/server/tools/baseline-diff/baseline-diff.schema.ts";
import { BASELINE_TARGET, type BaselineTarget } from "@/server/tools/baseline-diff/baseline-target.ts";

/** A project's baseline by name: its file, or why it cannot be read. */
type Listed =
  | { readonly name: string; readonly path: string; readonly baseline: BaselineFile }
  | { readonly name: string; readonly path: string; readonly reason: string };

/** A baseline read with where it lives. */
interface Found {
  readonly baseline: BaselineFile;
  readonly path: string;
}

/**
 * The project's baselines as baseline_diff lists them (T-204, T-205): one by name, each with how it compares now, and
 * without a name every one (of `file` when given) compared as counts, one at a time, at most 50 within a minute; the
 * rest, or all after a cancel, unchecked. One that cannot be read or compared (no plugin, its file not connected) is
 * listed unavailable with why, and the others are still checked.
 */
@injectable()
export class BaselineOverview {
  readonly #store;
  readonly #compare;
  readonly #target;
  readonly #clock;

  constructor(
    store = inject(BASELINE_STORE),
    compare: Pick<BaselineCompare, "compare"> = inject(BASELINE_COMPARE),
    target: Pick<BaselineTarget, "connected"> = inject(BASELINE_TARGET),
    clock = inject(CLOCK),
  ) {
    this.#store = store;
    this.#compare = compare;
    this.#target = target;
    this.#clock = clock;
  }

  /** One baseline by name with where it lives; an unknown name lists the project's (BaselineStore.required). */
  async one(name: string): Promise<Found> {
    return { baseline: await this.#store.required(name), path: await this.#store.path(name) };
  }

  async all(file: string | undefined, signal: AbortSignal): Promise<BaselineDiffOutput> {
    const listed = this.#ofFile(await this.#listed(), file);
    const shown = listed.slice(0, OVERVIEW_LIMIT.maxBaselines);
    const deadline = this.#clock.now() + OVERVIEW_LIMIT.checkMs;
    const entries: BaselineEntry[] = [];

    for (const each of shown) {
      const late = signal.aborted || this.#clock.now() >= deadline;

      // One at a time: each compares through the plugin, and the minute counts from the first.

      entries.push(late ? this.#plain(each, BASELINE_STATUS.unchecked) : await this.#checked(each));
    }

    const more = listed.length - shown.length;

    return { summary: this.#summary(entries, more), baselines: entries, ...(more === 0 ? {} : { more }), notes: [] };
  }

  /** A baseline as an answer lists it: what it holds, and how it compares now. */
  entry(
    baseline: BaselineFile,
    path: string,
    comparison: Comparison,
  ): BaselineEntry {
    return {
      ...this.#header(baseline, path),
      status: comparison.status,
      ...("diff" in comparison && comparison.now !== undefined ? { now: comparison.now } : {}),
      ...("reason" in comparison ? { reason: comparison.reason } : {}),
      ...("diff" in comparison ? { counts: comparison.diff.counts } : {}),
    };
  }

  /** Every baseline of the project by name, read; one that cannot be read with why. */
  async #listed(): Promise<Listed[]> {
    const names = await this.#store.names();
    const listed = await Promise.all(
      names.map(async (name): Promise<Listed[]> => {
        const path = await this.#store.path(name);

        try {
          const baseline = await this.#store.read(name);

          return baseline === null ? [] : [{ name, path, baseline }];
        } catch (error) {
          return [{ name, path, reason: error instanceof Error ? error.message : String(error) }];
        }
      }),
    );

    return listed.flat();
  }

  /** The baselines of the file `file` names (by key when it has one, else by name); all of them without it. */
  #ofFile(listed: Listed[], file: string | undefined): Listed[] {
    if (file === undefined) {
      return listed;
    }

    const connected = this.#target.connected(file);

    return listed.filter(
      (each) =>
        "baseline" in each &&
        connected !== undefined &&
        (connected.key === null
          ? each.baseline.file.name === connected.name
          : each.baseline.file.key === connected.key),
    );
  }

  async #checked(each: Listed): Promise<BaselineEntry> {
    if (!("baseline" in each)) {
      return this.#plain(each, BASELINE_STATUS.unavailable, each.reason);
    }

    try {
      return this.entry(each.baseline, each.path, await this.#compare.compare(each.baseline, undefined, undefined));
    } catch (error) {
      // No plugin, its file not connected or named twice: listed with why, the others still checked.
      return this.#plain(each, BASELINE_STATUS.unavailable, error instanceof Error ? error.message : String(error));
    }
  }

  /** A baseline left unchecked, or one that could not be read or compared, with why. */
  #plain(
    each: Listed,
    status: typeof BASELINE_STATUS.unavailable | typeof BASELINE_STATUS.unchecked,
    reason?: string,
  ): BaselineEntry {
    const header = "baseline" in each ? this.#header(each.baseline, each.path) : { name: each.name, path: each.path };

    return { ...header, status, ...(reason === undefined ? {} : { reason }) };
  }

  #header(baseline: BaselineFile, path: string): Omit<BaselineEntry, "status"> {
    const { name, node, file, page, capturedAt, code, version } = baseline;

    return { name, path, node, file, page, capturedAt, code, ...(version === null ? {} : { version }) };
  }

  /** Every baseline in a word: "3 baselines: pricing changed, checkout the same, pricing-mobile missing." */
  #summary(entries: readonly BaselineEntry[], more: number): string {
    if (entries.length === 0) {
      return BASELINE_DIFF_TEXT.noBaselines;
    }

    const statuses = entries.map(({ name, status }) => BASELINE_DIFF_TEXT.status(name, status));

    return BASELINE_DIFF_TEXT.overview(entries.length + more, statuses, more);
  }
}

export const BASELINE_OVERVIEW = new InjectionToken<BaselineOverview>("BaselineOverview");
