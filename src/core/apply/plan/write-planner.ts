import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CHANGE_KIND } from "@/core/apply/apply.constants.ts";
import type { ApplyChange, ApplyElement, ApplyError } from "@/core/apply/apply.types.ts";
import { ASSESSOR } from "@/core/apply/plan/assessor.ts";
import { CHANGE_OF } from "@/core/apply/plan/change-of.ts";
import type { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import { LAYER_READS } from "@/core/apply/plan/layer-reads.ts";
import { PLACED_LAYERS } from "@/core/apply/plan/placed-layers.ts";
import type { WritePlan } from "@/core/apply/plan/plan.types.ts";
import { PlannedComponents } from "@/core/apply/plan/planned-components.ts";

/**
 * The one planner (T-142): which layers a call reads, then each element against its layer (assessment), as a change in
 * Figma's terms, placed by its edges where nothing lays it out, with the list the plugin gets and the components a dry
 * run remembers. The same plan feeds the dry and the real run.
 */
@injectable()
export class WritePlanner {
  readonly #reads;
  readonly #assessor;
  readonly #changeOf;
  readonly #placed;

  constructor(
    reads = inject(LAYER_READS),
    assessor = inject(ASSESSOR),
    changeOf = inject(CHANGE_OF),
    placed = inject(PLACED_LAYERS),
  ) {
    this.#reads = reads;
    this.#assessor = assessor;
    this.#changeOf = changeOf;
    this.#placed = placed;
  }

  /** The ids the call reads before it plans (C-169). */
  layersToRead(elements: readonly ApplyElement[]): string[] {
    return this.#reads.ids(elements);
  }

  plan(elements: readonly ApplyElement[], layers: CurrentLayers): WritePlan {
    const { assessed, errors } = this.#assessor.assess(elements, layers);
    const byRef = new Map(assessed.map((item) => [item.element.ref, item]));
    const changes: ApplyChange[] = [];
    const notWritten = new Map<string, string[]>();

    for (const item of assessed) {
      const made = this.#changeOf.of(item.element, item.now, this.#placed.isPlaced(item, byRef));

      const unwritten = this.#changeOf.unwritten(item.element);

      if (unwritten.length > 0) {
        notWritten.set(item.element.ref, unwritten);
      }

      changes.push(made.change);
      errors.push(...made.errors);
    }

    const components = new PlannedComponents();
    const changed = new Map(changes.map((change) => [change.ref, change]));

    for (const change of changes) {
      components.record(change, changed);
    }

    return {
      changes,
      written: changes.filter((change) => this.#writes(change)),
      send: this.#sendList(changes),
      errors: this.#inOrder(errors),
      notWritten,
      components,
    };
  }

  /** Whether a change writes its layer: makes it, or gives it a property. */
  #writes(change: ApplyChange): boolean {
    return change.kind === CHANGE_KIND.create || Object.keys(change.props).length > 0;
  }

  /**
   * The changes the plugin gets (C-176): what writes something, and a layer made with its parent and the layers beside
   * it, unchanged, so the plugin finds where it goes. The rest stays here, in document order.
   */
  #sendList(changes: readonly ApplyChange[]): ApplyChange[] {
    const made = changes.filter((change) => change.kind === CHANGE_KIND.create);
    const parents = new Set(made.flatMap((change) => (change.parent === null ? [] : [change.parent])));
    const beside = new Set(made.map((change) => change.parent ?? ""));

    return changes.filter(
      (change) => this.#writes(change) || parents.has(change.ref) || beside.has(change.parent ?? ""),
    );
  }

  /** Errors in document order, the assessment's and the changes' together. */
  #inOrder(errors: readonly ApplyError[]): ApplyError[] {
    return [...errors].sort((first, second) => first.line - second.line || first.column - second.column);
  }
}

export const WRITE_PLANNER = new InjectionToken<WritePlanner>("WritePlanner");
