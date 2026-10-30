import { InjectionToken, injectable } from "@needle-di/core";
import { LINT_FIGMA, LINT_ID } from "@/core/checks/lint/lint.constants.ts";
import type { LintFinding } from "@/core/checks/lint/lint.schema.ts";
import type { LintLayer, LintRule } from "@/core/checks/lint/lint.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** Where a layer sits: in an instance's content, in a main component. */
interface Place {
  readonly inInstance: boolean;
  readonly inComponent: boolean;
}

/**
 * The lint's walk over one read (K-032): every layer in document order with where it sits; a hidden layer only for the
 * rules that read hidden layers, and never its insides; an instance's content is the component's, except what was
 * put into its slot.
 */
@injectable()
export class LintWalk {
  readonly #readLayers = new ReadLayers();

  findings(model: ReadModel, rules: readonly LintRule[]): LintFinding[] {
    const found: LintFinding[] = [];

    for (const place of this.#layers(model)) {
      for (const rule of rules.filter(({ hidden }) => place.layer.visible || hidden)) {
        for (const finding of rule.check(place)) {
          found.push({ rule: rule.id, severity: rule.severity, ...finding });
        }
      }
    }

    return found;
  }

  /** The read's layers with where each sits; below a hidden layer nothing is walked (its read is a stub, D-18). */
  *#layers(model: ReadModel): Generator<LintLayer> {
    const places = new Map<string, Place>();

    for (const { layer, parent } of this.#readLayers.walk(model.root)) {
      const above = parent === null ? undefined : places.get(parent.id);

      if (parent === null || (parent.visible && above !== undefined)) {
        const place = this.#place(layer, parent, above);

        places.set(layer.id, place);

        yield { layer, parent, model, ...place };
      }
    }
  }

  #place(
    layer: ReadLayer,
    parent: ReadLayer | null,
    above: Place | undefined,
  ): Place {
    const own = layer.type === LINT_FIGMA.instance;

    if (parent === null || above === undefined) {
      return { inInstance: own, inComponent: false };
    }

    // What an instance put into its slot is its own content; the slot's default content stays the component's.
    const kept = parent.type !== LINT_FIGMA.slot || this.#isDefaultContent(layer.id, parent.id);

    return {
      inInstance: own || (above.inInstance && kept),
      inComponent: above.inComponent || parent.type === LINT_FIGMA.component || parent.type === LINT_FIGMA.componentSet,
    };
  }

  /** A slot's default content keeps the id its component gave it, I<instance>;<id>, not one extending the slot's. */
  #isDefaultContent(id: string, slot: string): boolean {
    return id.startsWith(LINT_ID.instance) && !id.startsWith(LINT_ID.inSlot(slot));
  }
}

export const LINT_WALK = new InjectionToken<LintWalk>("LintWalk");
