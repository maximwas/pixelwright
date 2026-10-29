import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import type { XmlRead } from "@/core/design/design.types.ts";
import { DESIGN_XML } from "@/core/design/design-xml.ts";
import { DESIGN_FIT } from "@/core/design/fit/design-fit.ts";
import { FIT } from "@/core/design/fit/fit.constants.ts";
import { type Catalogue, READ_CATALOGUE } from "@/core/design/text/read-catalogue.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** design_read's answer before the tool adds the node: the XML, then the JSON block's catalogue, cuts and runs. */
export type DesignAnswer = Catalogue & XmlRead;

/**
 * design_read over a read model (T-050): the assets planned once and shared by the XML and the JSON block, the fit
 * planned once (T-054), then the read written with that plan and, when asked, its runs folded (T-059).
 */
@injectable()
export class DesignReader {
  readonly #design;
  readonly #fit;
  readonly #catalogue;
  readonly #planner;

  constructor(
    design = inject(DESIGN_XML),
    fit = inject(DESIGN_FIT),
    catalogue = inject(READ_CATALOGUE),
    planner = inject(ASSET_PLANNER),
  ) {
    this.#design = design;
    this.#fit = fit;
    this.#catalogue = catalogue;
    this.#planner = planner;
  }

  read(model: ReadModel, options: { readonly maxChars?: number; readonly repeats?: boolean } = {}): DesignAnswer {
    const { maxChars = FIT.maxChars, repeats = false } = options;
    const assets = this.#planner.plan(model);
    const plan = this.#fit.plan(model, maxChars, { assets, repeats });
    const read = this.#design.read(model, { ...plan, assets, repeats });

    return {
      xml: read.xml,
      ...this.#catalogue.read(model, assets, read.xml),
      truncated: read.truncated,
      ...(read.repeats === undefined ? {} : { repeats: read.repeats }),
    };
  }
}

export const DESIGN_READER = new InjectionToken<DesignReader>("DesignReader");
