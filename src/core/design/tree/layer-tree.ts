import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import { DESIGN_BUILDER } from "@/core/design/builder/design-builder.ts";
import { DESIGN_ATTRIBUTE, DESIGN_FLAG, INVISIBLE_TYPES, TEXT_TYPES } from "@/core/design/design.constants.ts";
import { INTERACTION_ATTRIBUTES } from "@/core/design/interactions/interaction-attributes.ts";
import { TEXT_CONTENT } from "@/core/design/text/text-content.ts";
import type { XmlAttribute, XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * A read as design_read's tree (C-140): an element per layer, a Text with its characters and Spans (C-120), a hidden layer as a stub with
 * no children (D-18), a slice left out (C-141); a layer's interactions as `$on-*` (C-154); an asset with no children,
 * its file holds them (C-142); a layer the read cut mid-children says how many it has. A fit's plan (T-054) empties
 * branches (`$truncated`), keeps a list's first children (`$children`) and shortens texts (`$truncated`).
 */
@injectable()
export class LayerTree {
  readonly #builder;
  readonly #text;
  readonly #interactions;
  readonly #assets;

  constructor(
    builder = inject(DESIGN_BUILDER),
    text = inject(TEXT_CONTENT),
    interactions = inject(INTERACTION_ATTRIBUTES),
    assets = inject(ASSET_PLANNER),
  ) {
    this.#builder = builder;
    this.#text = text;
    this.#interactions = interactions;
    this.#assets = assets;
  }

  /** The root's element; null for a root that draws nothing. */
  root(model: ReadModel, options: TreeOptions = {}): XmlElement | null {
    const assets = options.assets ?? this.#assets.plan(model);

    return this.#elements(model.root, model, null, { ...options, assets })[0] ?? null;
  }

  #elements(
    layer: ReadLayer,
    model: ReadModel,
    parent: ReadLayer | null,
    options: PlannedOptions,
  ): XmlElement[] {
    const { assets } = options;

    if (Object.hasOwn(INVISIBLE_TYPES, layer.type)) {
      return [];
    }

    if (!layer.visible) {
      return [{ ...this.#builder.stub(layer), content: null, children: [] }];
    }

    const built = this.#builder.element(layer, model, parent, assets);
    // C-154: the interactions are the last read-only attributes, before `$children`.
    const element = { ...built, attributes: [...built.attributes, ...this.#interactions.read(layer.reactions ?? [])] };

    if (assets.file(layer.id) !== undefined) {
      return [{ ...element, content: null, children: [] }];
    }

    const limit = options.limits?.get(layer.id);

    if (Object.hasOwn(TEXT_TYPES, layer.type)) {
      return [
        {
          ...element,
          attributes: [...element.attributes, ...this.#truncated(limit !== undefined)],
          content: this.#text.content(layer, model, limit),
          children: [],
        },
      ];
    }

    if (options.cut?.has(layer.id) ?? false) {
      return [
        { ...element, attributes: [...element.attributes, ...this.#truncated(true)], content: null, children: [] },
      ];
    }

    const { children, stopped } = this.#children(layer, model, options, limit);

    return [{ ...element, attributes: [...element.attributes, ...this.#cut(layer, stopped)], content: null, children }];
  }

  /** The children's elements, built only up to `limit`; `stopped` when a child that shows was left past it. */
  #children(
    layer: ReadLayer,
    model: ReadModel,
    options: PlannedOptions,
    limit: number | undefined,
  ): { children: XmlElement[]; stopped: boolean } {
    const children: XmlElement[] = [];

    for (const child of layer.children ?? []) {
      // A slice is no element: it neither counts toward the limit nor is left out by it.
      if (!Object.hasOwn(INVISIBLE_TYPES, child.type)) {
        if (children.length === limit) {
          return { children, stopped: true };
        }

        children.push(...this.#elements(child, model, layer, options));
      }
    }

    return { children, stopped: false };
  }

  /** `$children` when the read did not list every child: the fit's limit, or the read's budget, stopped mid-children. */
  #cut(layer: ReadLayer, stopped: boolean): XmlAttribute[] {
    return stopped || (layer.children?.length ?? 0) < layer.childCount
      ? [[DESIGN_ATTRIBUTE.children, String(layer.childCount)]]
      : [];
  }

  #truncated(truncated: boolean): XmlAttribute[] {
    return truncated ? [[DESIGN_ATTRIBUTE.truncated, DESIGN_FLAG.on]] : [];
  }
}

/** What a read shows: the asset plan to share with the JSON block, and a fit's cuts (T-054). */
export interface TreeOptions {
  readonly assets?: AssetPlan;
  /** Layers shown without their children, `$truncated="true"`. */
  readonly cut?: ReadonlySet<string>;
  /** At most this many children of a layer (`$children` says how many it has), or a text's first characters. */
  readonly limits?: ReadonlyMap<string, number>;
}

type PlannedOptions = TreeOptions & { readonly assets: AssetPlan };

export const LAYER_TREE = new InjectionToken<LayerTree>("LayerTree");
