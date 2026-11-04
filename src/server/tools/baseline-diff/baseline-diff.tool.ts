import { inject, injectable } from "@needle-di/core";
import type { BaselineCounts } from "@/core/diff/baseline/baseline.schema.ts";
import { BASELINE_STORE } from "@/server/app/stores/baseline-store.ts";
import { SEEN_DESIGNS } from "@/server/app/stores/seen-designs.ts";
import { BASELINE_TEXT } from "@/server/app/stores/stores.constants.ts";
import type { BaselineFile } from "@/server/app/stores/stores.schema.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { BASELINE_COMPARE, type Comparison } from "@/server/tools/baseline-diff/baseline-compare.ts";
import { BASELINE_DIFF_TEXT } from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import {
  type BaselineDiffInput,
  BaselineDiffInputSchema,
  type BaselineDiffOutput,
  type BaselineEntry,
} from "@/server/tools/baseline-diff/baseline-diff.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * baseline_diff with a name (T-205..T-208): the project's baseline against the design now, change by change in
 * design_read's terms, in the file it came from and with its own layer found again. The design compared is kept under
 * the answer's accept, so baseline_save keeps exactly what was reviewed. Reads only.
 */
@injectable()
export class BaselineDiffTool extends Tool<BaselineDiffInput, BaselineDiffOutput> {
  protected readonly input = BaselineDiffInputSchema;
  readonly #store;
  readonly #seen;
  readonly #compare;

  constructor(
    store = inject(BASELINE_STORE),
    seen = inject(SEEN_DESIGNS),
    compare = inject(BASELINE_COMPARE),
  ) {
    super();
    this.#store = store;
    this.#seen = seen;
    this.#compare = compare;
  }

  protected async run({ name, node, file }: BaselineDiffInput): Promise<BaselineDiffOutput> {
    // shortcut: without a name 0.7.0 gave every baseline's status; that overview is not built yet.
    if (name === undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_DIFF_TEXT.nameNeeded);
    }

    const baseline = await this.#store.read(name);

    if (baseline === null) {
      throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_DIFF_TEXT.noBaseline(name, await this.#store.names()));
    }

    const comparison = await this.#compare.compare(baseline, node, file);
    const baselines = [this.#entry(baseline, await this.#store.path(name), comparison)];

    if (!("diff" in comparison)) {
      return { summary: BASELINE_DIFF_TEXT.notCompared(name, comparison.reason), baselines, notes: comparison.notes };
    }

    const { diff, capture } = comparison;
    const accept = this.#seen.keep({
      name,
      node: capture.node,
      file: capture.file,
      page: capture.page ?? baseline.page,
      plugin: capture.by.plugin,
      snapshot: capture.snapshot,
      tokens: capture.tokens,
      capturedAt: capture.capturedAt,
      baselineCapturedAt: baseline.capturedAt,
    });

    return {
      summary: this.#summary(baseline, diff.counts),
      baselines,
      changes: diff.changes,
      accept,
      ...(diff.more === 0 ? {} : { more: diff.more }),
      notes: comparison.notes,
    };
  }

  /** A baseline as the answer lists it: what it holds, and how it compares now. */
  #entry(
    baseline: BaselineFile,
    path: string,
    comparison: Comparison,
  ): BaselineEntry {
    const { node, file, page, capturedAt, code, version } = baseline;

    return {
      name: baseline.name,
      path,
      node,
      file,
      page,
      capturedAt,
      code,
      ...(version === null ? {} : { version }),
      status: comparison.status,
      ...("diff" in comparison && comparison.now !== undefined ? { now: comparison.now } : {}),
      ...("reason" in comparison ? { reason: comparison.reason } : {}),
      ...("diff" in comparison ? { counts: comparison.diff.counts } : {}),
    };
  }

  /** What changed since the baseline was saved, or that it reads the same. */
  #summary(baseline: BaselineFile, counts: BaselineCounts): string {
    const head = BASELINE_DIFF_TEXT.head(baseline.name, baseline.node.name, baseline.node.id);
    const since = BASELINE_TEXT.utc(baseline.capturedAt);
    const layers = [
      BASELINE_DIFF_TEXT.counted(counts.changed, BASELINE_DIFF_TEXT.layerChanged, BASELINE_DIFF_TEXT.layersChanged),
      BASELINE_DIFF_TEXT.counted(counts.added, BASELINE_DIFF_TEXT.added),
      BASELINE_DIFF_TEXT.counted(counts.removed, BASELINE_DIFF_TEXT.removed),
      BASELINE_DIFF_TEXT.counted(counts.moved, BASELINE_DIFF_TEXT.moved),
      BASELINE_DIFF_TEXT.counted(counts.reordered, BASELINE_DIFF_TEXT.reordered),
    ].filter((part) => part !== "");

    return layers.length === 0
      ? BASELINE_DIFF_TEXT.same(head, since)
      : BASELINE_DIFF_TEXT.since(head, since, [layers.join(BASELINE_DIFF_TEXT.partJoiner)]);
  }
}
