import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { BaselineComparison } from "@/core/diff/baseline/baseline.types.ts";
import { BASELINE_DIFF } from "@/core/diff/baseline/baseline-diff.ts";
import { BASELINE_CAPTURE } from "@/server/app/stores/baseline-capture.ts";
import type { BaselineFile } from "@/server/app/stores/stores.schema.ts";
import { BASELINE_DIFF_TEXT, BASELINE_STATUS } from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import { BASELINE_ROOT, type LayerNow } from "@/server/tools/baseline-diff/baseline-root.ts";
import { BASELINE_TARGET } from "@/server/tools/baseline-diff/baseline-target.ts";

/** A baseline that could not be compared, and why. */
interface Uncompared {
  readonly status: typeof BASELINE_STATUS.missing | typeof BASELINE_STATUS.hidden | typeof BASELINE_STATUS.unavailable;
  readonly reason: string;
  readonly notes: string[];
}

/** A baseline compared: the diff, the read now (what an accept keeps), the layer compared when not its own. */
interface Compared {
  readonly status: typeof BASELINE_STATUS.same | typeof BASELINE_STATUS.changed;
  readonly diff: BaselineComparison;
  readonly capture: BaselineFile;
  readonly now?: LayerNow;
  readonly notes: string[];
}

export type Comparison = Uncompared | Compared;

/**
 * A baseline compared in the file it came from (or `file`), with its own layer (or `node`, or the one found again by
 * name), read the way baseline_save read it and compared by core's BaselineDiff (T-205..T-207). A file that cannot be
 * found is an error; a gone, hidden or other layer is a status.
 */
@injectable()
export class BaselineCompare {
  readonly #target;
  readonly #root;
  readonly #capture;
  readonly #diff;

  constructor(
    target = inject(BASELINE_TARGET),
    root = inject(BASELINE_ROOT),
    capture = inject(BASELINE_CAPTURE),
    diff = inject(BASELINE_DIFF),
  ) {
    this.#target = target;
    this.#root = root;
    this.#capture = capture;
    this.#diff = diff;
  }

  async compare(
    baseline: BaselineFile,
    node: string | undefined,
    file: string | undefined,
  ): Promise<Comparison> {
    const target = this.#target.target(baseline.file, file);
    const root = await this.#root.locate(target.session, baseline, node);

    if ("reason" in root) {
      return { ...root, notes: target.notes };
    }

    const captured = await this.#capture.capture(target.session, root.id, baseline.name);

    if ("hidden" in captured) {
      return {
        status: BASELINE_STATUS.hidden,
        reason: BASELINE_DIFF_TEXT.hidden(captured.hidden),
        notes: target.notes,
      };
    }

    const capture = captured.baseline;
    const sameReader = baseline.by.plugin === capture.by.plugin;
    const diff = this.#diff.compare(
      { snapshot: baseline.snapshot, tokens: baseline.tokens },
      { snapshot: capture.snapshot, tokens: capture.tokens },
      sameReader,
    );
    const now = node === undefined ? root.now : { id: capture.node.id, name: capture.node.name };

    return {
      status: diff.same ? BASELINE_STATUS.same : BASELINE_STATUS.changed,
      diff,
      capture,
      ...(now === undefined ? {} : { now }),
      notes: [
        ...target.notes,
        ...root.notes,
        ...captured.notes,
        ...diff.notes,
        ...(sameReader ? [] : [BASELINE_DIFF_TEXT.reader(baseline.by.plugin, capture.by.plugin)]),
      ],
    };
  }
}

export const BASELINE_COMPARE = new InjectionToken<BaselineCompare>("BaselineCompare");
