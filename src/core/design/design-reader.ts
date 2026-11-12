import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import type { XmlRead } from "@/core/design/design.types.ts";
import { DESIGN_XML } from "@/core/design/design-xml.ts";
import { DESIGN_FIT } from "@/core/design/fit/design-fit.ts";
import { FIT } from "@/core/design/fit/fit.constants.ts";
import { READ_JSON, type ReadJsonBlock } from "@/core/design/read-json.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** design_read's answer before the tool adds the node: the XML, then the JSON block's catalogue, cuts and runs. */
export type DesignAnswer = ReadJsonBlock & XmlRead;

/**
 * design_read over a read model (T-050): the assets planned once and shared by the XML and the JSON block, the fit
 * planned once (T-054), then the read written with that plan and, when asked, its runs folded (T-059); the JSON block
 * with its measurements and hints (T-061).
 */
@injectable()
export class DesignReader {
  readonly #design;
  readonly #fit;
  readonly #json;
  readonly #planner;

  constructor(
    design = inject(DESIGN_XML),
    fit = inject(DESIGN_FIT),
    json = inject(READ_JSON),
    planner = inject(ASSET_PLANNER),
  ) {
    this.#design = design;
    this.#fit = fit;
    this.#json = json;
    this.#planner = planner;
  }

  /** `assets`: the read's plan when the caller made it (its files written, T-055); planned here otherwise. */
  read(model: ReadModel,    options: { readonly maxChars?: number; readonly repeats?: boolean; readonly assets?: AssetPlan } = {}): DesignAnswer {
    return this.built(model, options).answer;
  }

  /** The answer and the tree its XML was written from: code filters layers on the tree (Code Mode, decision 2). */
  built(model: ReadModel,    options: { readonly maxChars?: number; readonly repeats?: boolean; readonly assets?: AssetPlan } = {}): { readonly answer: DesignAnswer; readonly tree: XmlElement | null } {
    const { maxChars = FIT.maxChars, repeats = false } = options;
    const assets = options.assets ?? this.#planner.plan(model);
    const plan = this.#fit.plan(model, maxChars, { assets, repeats });
    const { read, tree } = this.#design.render(model, { ...plan, assets, repeats });
    const answer = {
      xml: read.xml,
      ...this.#json.read(model, assets, { tree, xml: read.xml }),
      truncated: read.truncated,
      ...(read.repeats === undefined ? {} : { repeats: read.repeats }),
    };

    return { answer, tree };
  }
}

export const DESIGN_READER = new InjectionToken<DesignReader>("DesignReader");
