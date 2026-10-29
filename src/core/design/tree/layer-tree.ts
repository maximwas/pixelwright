import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DESIGN_BUILDER } from "@/core/design/builder/design-builder.ts";
import { DESIGN_ATTRIBUTE, INVISIBLE_TYPES, TEXT_TYPES } from "@/core/design/design.constants.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { XmlAttribute, XmlContent, XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * A read as design_read's tree (C-140): an element per layer, a Text with its characters, a hidden layer as a stub with
 * no children (D-18), a slice left out (C-141); a layer the read cut mid-children says how many it has.
 */
@injectable()
export class LayerTree {
  readonly #builder;

  constructor(builder = inject(DESIGN_BUILDER)) {
    this.#builder = builder;
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

    const element = this.#builder.element(layer, model, parent);

    if (Object.hasOwn(TEXT_TYPES, layer.type)) {
      return [{ ...element, content: this.#content(layer), children: [] }];
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

  /** A Text's characters, in one piece: the CSS of its runs, which splits them into Spans, comes with the CSS. */
  #content(layer: ReadLayer): XmlContent[] {
    const characters = layer.text?.characters ?? "";

    return characters === "" ? [] : [{ kind: XML_CONTENT.text, value: characters }];
  }
}

export const LAYER_TREE = new InjectionToken<LayerTree>("LayerTree");
