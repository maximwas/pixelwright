import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { ApplyElement, ApplyError } from "@/core/apply/apply.types.ts";
import type { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import { LAYER_READS } from "@/core/apply/plan/layer-reads.ts";
import { PLAN_TEXT } from "@/core/apply/plan/plan.constants.ts";
import type { Assessment } from "@/core/apply/plan/plan.types.ts";
import { UNCHANGED } from "@/core/apply/plan/unchanged.ts";

/**
 * Each element against the layer it names (C-168): what the layer holds already. A named layer the read could not take
 * (past its size budget) is refused rather than written whole, every attribute rounded; one the file does not hold
 * and a copy's own source go to the plugin, which answers for them.
 */
@injectable()
export class Assessor {
  readonly #unchanged;
  readonly #reads;

  constructor(unchanged = inject(UNCHANGED), reads = inject(LAYER_READS)) {
    this.#unchanged = unchanged;
    this.#reads = reads;
  }

  assess(elements: readonly ApplyElement[], layers: CurrentLayers): { assessed: Assessment[]; errors: ApplyError[] } {
    const byRef = this.#reads.byRef(elements);
    const assessed: Assessment[] = [];
    const errors: ApplyError[] = [];

    for (const element of elements) {
      const named = this.#reads.named(element, byRef);
      const entry = named === null ? undefined : layers.entry(named);

      if (
        named !== null &&
        entry === undefined &&
        !layers.isMissing(named) &&
        element.attributes.copyOf === undefined
      ) {
        errors.push({
          line: element.line,
          column: element.column,
          ...(element.id === null ? {} : { id: element.id }),
          message: PLAN_TEXT.unread(named),
          hint: PLAN_TEXT.unreadHint,
        });
      } else {
        assessed.push(entry === undefined ? { element } : { element, entry, now: this.#unchanged.of(element, entry) });
      }
    }

    return { assessed, errors };
  }
}

export const ASSESSOR = new InjectionToken<Assessor>("Assessor");
