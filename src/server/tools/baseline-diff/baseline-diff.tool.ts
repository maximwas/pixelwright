import { inject, injectable } from "@needle-di/core";
import { COMPONENT_CHANGE } from "@/core/diff/baseline/baseline.constants.ts";
import type { BaselineChanges, BaselineCounts } from "@/core/diff/baseline/baseline.schema.ts";
import { BASELINE_TEXT } from "@/server/app/baselines/baselines.constants.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import { SEEN_DESIGNS } from "@/server/app/baselines/seen-designs.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOOL_CONTEXT, type ToolContext } from "@/server/app/tool-runner/tool-runner.ts";
import { BASELINE_COMPARE, type BaselineCompare } from "@/server/tools/baseline-diff/baseline-compare.ts";
import { BASELINE_DIFF_TEXT } from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import {
  type BaselineDiffInput,
  BaselineDiffInputSchema,
  type BaselineDiffOutput,
} from "@/server/tools/baseline-diff/baseline-diff.schema.ts";
import { BASELINE_OVERVIEW } from "@/server/tools/baseline-diff/baseline-overview.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * baseline_diff (T-204..T-208): with a name, the project's baseline against the design now, change by change in
 * design_read's terms, in the file it came from and with its own layer found again; the design compared is kept under
 * the answer's accept, so baseline_save keeps exactly what was reviewed. Without one, every baseline's status. Reads only.
 */
@injectable()
export class BaselineDiffTool extends Tool<BaselineDiffInput, BaselineDiffOutput> {
  protected readonly input = BaselineDiffInputSchema;
  readonly #seen;
  readonly #compare;
  readonly #overview;
  readonly #context;

  constructor(
    seen = inject(SEEN_DESIGNS),
    compare: Pick<BaselineCompare, "compare"> = inject(BASELINE_COMPARE),
    overview = inject(BASELINE_OVERVIEW),
    context: Pick<ToolContext, "signal"> = inject(TOOL_CONTEXT),
  ) {
    super();
    this.#seen = seen;
    this.#compare = compare;
    this.#overview = overview;
    this.#context = context;
  }

  protected async run({ name, node, file }: BaselineDiffInput): Promise<BaselineDiffOutput> {
    if (name === undefined) {
      if (node !== undefined) {
        throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_DIFF_TEXT.nodeNeedsName);
      }

      return this.#overview.all(file, this.#context.signal);
    }

    const { baseline, path } = await this.#overview.one(name);
    const comparison = await this.#compare.compare(baseline, node, file);
    const baselines = [this.#overview.entry(baseline, path, comparison)];

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
      summary: this.#summary(baseline, diff.changes, diff.counts),
      baselines,
      changes: diff.changes,
      accept,
      ...(diff.more === 0 ? {} : { more: diff.more }),
      notes: comparison.notes,
    };
  }

  /** What changed since the baseline was saved (layers, each component change, tokens), or that it reads the same. */
  #summary(
    baseline: BaselineFile,
    changes: BaselineChanges,
    counts: BaselineCounts,
  ): string {
    const text = BASELINE_DIFF_TEXT;
    const head = text.head(baseline.name, baseline.node.name, baseline.node.id);
    const since = BASELINE_TEXT.utc(baseline.capturedAt);

    if (Object.values(counts).every((count) => count === 0)) {
      return text.same(head, since);
    }

    const layers = [
      text.counted(counts.changed, text.layerChanged, text.layersChanged),
      text.counted(counts.added, text.added),
      text.counted(counts.removed, text.removed),
      text.counted(counts.moved, text.moved),
      text.counted(counts.reordered, text.reordered),
    ].filter((part) => part !== "");
    const components = changes.components.map((entry) =>
      text.component(entry.component, this.#verb(entry), entry.instances.length, entry.of),
    );
    const tokens = text.counted(counts.tokens, text.tokenChanged, text.tokensChanged);

    return text.since(
      head,
      since,
      [layers.join(text.partJoiner), ...components, tokens].filter((part) => part !== ""),
    );
  }

  /** A component change in a word: added, removed, redrawn when only its drawing changed, else changed. */
  #verb(entry: BaselineChanges["components"][number]): string {
    if (entry.change !== COMPONENT_CHANGE.changed) {
      return entry.change;
    }

    return entry.drawing !== undefined && entry.attributes === undefined ? BASELINE_DIFF_TEXT.redrawn : entry.change;
  }
}
