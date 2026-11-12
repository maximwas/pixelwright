import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { DESIGN_HINTS } from "@/core/design/hints/design-hints.ts";
import { type Catalogue, READ_CATALOGUE } from "@/core/design/text/read-catalogue.ts";
import { MEASUREMENTS, type MeasurementView } from "@/core/inspect/measurements.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** The JSON block beside the XML: the catalogue, the designer's measurements when there are any, the hints. */
export type ReadJsonBlock = Catalogue & { readonly measurements?: MeasurementView[]; readonly hints: string[] };

/** design_read's JSON block (T-061) in 0.7.0's order: tokens, textStyles, fonts, assets, measurements, hints. */
@injectable()
export class ReadJson {
  readonly #catalogue;
  readonly #hints;
  readonly #measurements;

  constructor(
    catalogue = inject(READ_CATALOGUE),
    hints = inject(DESIGN_HINTS),
    measurements = inject(MEASUREMENTS),
  ) {
    this.#catalogue = catalogue;
    this.#hints = hints;
    this.#measurements = measurements;
  }

  /** `assets`: the read's one plan; `tree` and `xml`: the read as built and as written. */
  read(
    model: ReadModel,
    assets: AssetPlan,
    written: { readonly tree: XmlElement | null; readonly xml: string },
  ): ReadJsonBlock {
    const catalogue = this.#catalogue.read(model, assets, written.xml);
    const measurements = this.#measurements.read(model);

    return {
      ...catalogue,
      ...(measurements.length === 0 ? {} : { measurements }),
      hints: this.#hints.read(model, written.tree, catalogue.tokens),
    };
  }
}

export const READ_JSON = new InjectionToken<ReadJson>("ReadJson");
