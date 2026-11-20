import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { LayerEntry } from "@/core/apply/plan/plan.types.ts";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import { DESIGN_BUILDER } from "@/core/design/builder/design-builder.ts";
import { TEXT_CONTENT } from "@/core/design/text/text-content.ts";
import type { XmlContent } from "@/core/xml/xml.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer's element as design_read writes it: attribute by name. */
export type Render = ReadonlyMap<string, string>;

/**
 * A layer as design_read writes it, for Unchanged to compare an element with (C-170): its attributes inside a parent,
 * rendered once per call (the read's AssetPlan included), and a Text's content, its Spans with what they set.
 */
@injectable()
export class LayerRenders {
  readonly #builder;
  readonly #assets;
  readonly #texts;
  /** Each call's entries and reads are its own (CurrentLayers), so these live as long as one call. */
  readonly #renders = new WeakMap<LayerEntry, Map<ReadLayer | null, Render>>();
  readonly #plans = new WeakMap<ReadModel, AssetPlan>();

  constructor(
    builder = inject(DESIGN_BUILDER),
    assets = inject(ASSET_PLANNER),
    texts = inject(TEXT_CONTENT),
  ) {
    this.#builder = builder;
    this.#assets = assets;
    this.#texts = texts;
  }

  /** The layer's element inside `parent` (null: as the read's root); a hidden layer rendered as shown. */
  attributes(entry: LayerEntry, parent: ReadLayer | null): Render {
    const renders = this.#renders.get(entry) ?? new Map<ReadLayer | null, Render>();
    const held = renders.get(parent);

    this.#renders.set(entry, renders);

    if (held !== undefined) {
      return held;
    }

    const { layer, model } = entry;
    const shown = layer.visible ? layer : { ...layer, visible: true };
    const plan = this.#plans.get(model) ?? this.#assets.plan(model);
    const render = new Map(this.#builder.element(shown, model, parent, plan).attributes);

    this.#plans.set(model, plan);
    renders.set(parent, render);

    return render;
  }

  content({ layer, model }: LayerEntry): XmlContent[] {
    return this.#texts.content(layer, model);
  }
}

export const LAYER_RENDERS = new InjectionToken<LayerRenders>("LayerRenders");
