import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DESIGN_BUILDER } from "@/core/design/builder/design-builder.ts";
import { DESIGN_ATTRIBUTE, INVISIBLE_TYPES, TEXT_TYPES } from "@/core/design/design.constants.ts";
import { INTERACTION_ATTRIBUTES } from "@/core/design/interactions/interaction-attributes.ts";
import { TEXT_CONTENT_READER } from "@/core/design/text/text-content.ts";
import type { XmlAttribute, XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * A read as design_read's tree (C-140): an element per layer, a Text with its characters and Spans (C-120), a hidden layer as a stub with
 * no children (D-18), a slice left out (C-141); a layer's interactions as `$on-*` (C-154); a layer the read cut
 * mid-children says how many it has.
 */
@injectable()
export class LayerTree {
  readonly #builder;
  readonly #text;
  readonly #interactions;

  constructor(
    builder = inject(DESIGN_BUILDER),
    text = inject(TEXT_CONTENT_READER),
    interactions = inject(INTERACTION_ATTRIBUTES),
  ) {
    this.#builder = builder;
    this.#text = text;
    this.#interactions = interactions;
  }

  /** The root's element; null for a root that draws nothing. */
  root(model: ReadModel): XmlElement | null {
    return this.#elements(model.root, model, null)[0] ?? null;
  }

  #elements(
    layer: ReadLayer,
    model: ReadModel,
    parent: ReadLayer | null,
  ): XmlElement[] {
    if (Object.hasOwn(INVISIBLE_TYPES, layer.type)) {
      return [];
    }

    if (!layer.visible) {
      return [{ ...this.#builder.stub(layer), content: null, children: [] }];
    }

    const built = this.#builder.element(layer, model, parent);
    // C-154: the interactions are the last read-only attributes, before `$children`.
    const element = { ...built, attributes: [...built.attributes, ...this.#interactions.read(layer.reactions ?? [])] };

    if (Object.hasOwn(TEXT_TYPES, layer.type)) {
      return [{ ...element, content: this.#text.content(layer, model), children: [] }];
    }

    const children = layer.children ?? [];

    return [
      {
        ...element,
        attributes: [...element.attributes, ...this.#cut(layer, children.length)],
        content: null,
        children: children.flatMap((child) => this.#elements(child, model, layer)),
      },
    ];
  }

  /** `$children` when the read listed fewer children than the layer has: its budget can stop mid-children. */
  #cut(layer: ReadLayer, listed: number): XmlAttribute[] {
    return listed < layer.childCount ? [[DESIGN_ATTRIBUTE.children, String(layer.childCount)]] : [];
  }
}

export const LAYER_TREE = new InjectionToken<LayerTree>("LayerTree");
