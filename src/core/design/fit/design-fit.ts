import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TEXT_TYPES } from "@/core/design/design.constants.ts";
import { DESIGN_XML, type DesignOptions } from "@/core/design/design-xml.ts";
import { FIT } from "@/core/design/fit/fit.constants.ts";
import type { FitPlan } from "@/core/design/fit/fit.types.ts";
import { FitRound } from "@/core/design/fit/fit-round.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * The cuts that fit a read into maxChars (T-054): branches are emptied deepest first and, at one depth, largest first,
 * so every section keeps its place and its own attributes; when that is not enough (a flat or very wide tree), the
 * widest elements keep only their first children, and at last the longest texts are shortened. Planned once, so a
 * second render (with other asset paths) cuts the same; a folded run is never cut apart.
 */
@injectable()
export class DesignFit {
  readonly #readLayers = new ReadLayers();
  readonly #design;

  constructor(design = inject(DESIGN_XML)) {
    this.#design = design;
  }

  plan(
    model: ReadModel,
    maxChars: number,
    options: DesignOptions = {},
  ): FitPlan {
    const plan: FitPlan = { cut: new Set(), limits: new Map() };
    const texts = this.#texts(model.root, new Map());

    for (let round = 0; round < FIT.rounds; round += 1) {
      const render = this.#design.render(model, { ...options, ...plan });

      if (render.read.xml.length <= maxChars) {
        break;
      }

      const fitting = new FitRound(render, plan, maxChars);

      fitting.cutBranches();

      if (!fitting.fits) {
        fitting.shortenLists();
      }

      if (!fitting.fits) {
        fitting.shortenTexts(texts);
      }
    }

    return plan;
  }

  /** Each text layer's length by its id: the last round shortens the longest. */
  #texts(root: ReadLayer, found: Map<string, number>): Map<string, number> {
    for (const { layer } of this.#readLayers.walk(root)) {
      if (layer.type === TEXT_TYPES.TEXT) {
        found.set(layer.id, layer.text?.characters.length ?? 0);
      }
    }

    return found;
  }
}

export const DESIGN_FIT = new InjectionToken<DesignFit>("DesignFit");
