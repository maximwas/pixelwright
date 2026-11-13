import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { ApplyChange, ApplyElement } from "@/core/apply/apply.types.ts";
import type { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import type { WritePlan } from "@/core/apply/plan/plan.types.ts";
import { WRITE_PLANNER } from "@/core/apply/plan/write-planner.ts";
import { type AttachCall, type Attached, FILE_ATTACH } from "@/server/tools/design-apply/file-attach.ts";
import { FILE_CHANGES } from "@/server/tools/design-apply/file-changes.ts";
import { FONT_RANGES } from "@/server/tools/design-apply/font-ranges.ts";
import type { SourceReads } from "@/server/tools/design-apply/source-files.ts";
import type { FontAxes } from "@/shared/ops/apply/apply.schema.ts";

/** A call's plan and the files it read for it, which the write uses again. */
export interface FiledPlan {
  readonly plan: WritePlan;
  readonly reads: SourceReads;
  /** The axis ranges the changes' font-variation-settings are checked against. */
  readonly fontAxes: FontAxes;
}

/**
 * design_apply's plan with its files (T-131, T-132): the elements planned against their layers, then the files they
 * name compared with those layers by their bytes; when a file changes something or cannot be used the call is planned
 * again with that known; the axis ranges the plan's font-variation-settings need come from the font catalogue. Before
 * the write, the files go on the changes and the images to the plugin.
 */
@injectable()
export class ApplyFiles {
  readonly #planner;
  readonly #changes;
  readonly #attach;
  readonly #ranges;

  constructor(
    planner = inject(WRITE_PLANNER),
    changes = inject(FILE_CHANGES),
    attach = inject(FILE_ATTACH),
    ranges = inject(FONT_RANGES),
  ) {
    this.#planner = planner;
    this.#changes = changes;
    this.#attach = attach;
    this.#ranges = ranges;
  }

  /** The ids the call reads before it plans (C-169). */
  layersToRead(elements: readonly ApplyElement[]): string[] {
    return this.#planner.layersToRead(elements);
  }

  async plan(elements: readonly ApplyElement[], layers: CurrentLayers): Promise<FiledPlan> {
    const reads: SourceReads = new Map();
    const first = this.#planner.plan(elements, layers);
    const files = await this.#changes.of(first.assessed, reads);
    const filed = [...files.values()].some(({ changed, problems }) => changed.length > 0 || problems.length > 0);

    const plan = filed ? this.#planner.plan(elements, layers, files) : first;

    return { plan, reads, fontAxes: await this.#ranges.of(plan.send, layers) };
  }

  attach(changes: readonly ApplyChange[], call: AttachCall): Promise<Attached> {
    return this.#attach.attach(changes, call);
  }
}

export const APPLY_FILES = new InjectionToken<ApplyFiles>("ApplyFiles");
