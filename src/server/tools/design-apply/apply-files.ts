import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { ApplyChange, ApplyElement } from "@/core/apply/apply.types.ts";
import type { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import type { WritePlan } from "@/core/apply/plan/plan.types.ts";
import { WRITE_PLANNER } from "@/core/apply/plan/write-planner.ts";
import { type AttachCall, type Attached, FILE_ATTACH } from "@/server/tools/design-apply/file-attach.ts";
import { FILE_CHANGES } from "@/server/tools/design-apply/file-changes.ts";
import type { SourceReads } from "@/server/tools/design-apply/source-files.ts";

/** A call's plan and the files it read for it, which the write uses again. */
export interface FiledPlan {
  readonly plan: WritePlan;
  readonly reads: SourceReads;
}

/**
 * design_apply's plan with its files (T-131, T-132): the elements planned against their layers, then the files they
 * name compared with those layers by their bytes; when a file changes something or cannot be used the call is planned
 * again with that known. Before the write, the files go on the changes and the images to the plugin.
 */
@injectable()
export class ApplyFiles {
  readonly #planner;
  readonly #changes;
  readonly #attach;

  constructor(
    planner = inject(WRITE_PLANNER),
    changes = inject(FILE_CHANGES),
    attach = inject(FILE_ATTACH),
  ) {
    this.#planner = planner;
    this.#changes = changes;
    this.#attach = attach;
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

    return { plan: filed ? this.#planner.plan(elements, layers, files) : first, reads };
  }

  attach(changes: readonly ApplyChange[], call: AttachCall): Promise<Attached> {
    return this.#attach.attach(changes, call);
  }
}

export const APPLY_FILES = new InjectionToken<ApplyFiles>("ApplyFiles");
