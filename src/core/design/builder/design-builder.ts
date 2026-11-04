import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_READER } from "@/core/css/css-reader.ts";
import { TEXT_PATH_DATA } from "@/core/css/groups/text/text-path-data.ts";
import type { CssDeclaration } from "@/core/css/registry/css-declarations.ts";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { ASSET_TAG } from "@/core/design/assets/assets.constants.ts";
import {
  BUILDER_VALUE,
  CSS_NOTES,
  DEV_STATUS_WORDS,
  NOTE,
  PIN_WORDS,
  PINS,
  TEXT_PIN_WORDS,
} from "@/core/design/builder/builder.constants.ts";
import { PROPERTY_FIELD } from "@/core/design/component/component.constants.ts";
import { COMPONENT_ATTRIBUTES } from "@/core/design/component/component-attributes.ts";
import { DESIGN_ATTRIBUTE, TEXT_TYPES } from "@/core/design/design.constants.ts";
import type { MaybeAttribute } from "@/core/design/design.types.ts";
import { NODE_TAG } from "@/core/xml/node-tag.ts";
import type { XmlAttribute, XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer's element before its content or children: its id, its tag and its attributes. */
type LayerElement = Pick<XmlElement, "id" | "tag" | "attributes">;

/**
 * A layer's element as design_read writes it: Figma's type as its tag and its attributes in C-1.3 order, what the layer
 * is (id, name, component, notes, overrides, status, link, modes, mask; ComponentAttributes gives the component's
 * part), its CSS in CSS_ORDER, then the read-only `$` attributes (the
 * component properties it is bound to, the CSS it cannot write back as `$css`, its grid style). An asset is an `Icon` or
 * `Image` with its planned `src` and only the CSS its element keeps (C-142, C-143).
 */
@injectable()
export class DesignBuilder {
  readonly #tags;
  readonly #component;
  readonly #css;
  readonly #paths;

  constructor(
    tags = inject(NODE_TAG),
    component = inject(COMPONENT_ATTRIBUTES),
    css = inject(CSS_READER),
    paths = inject(TEXT_PATH_DATA),
  ) {
    this.#tags = tags;
    this.#component = component;
    this.#css = css;
    this.#paths = paths;
  }

  /** `parent`: the layer's parent in the read, which decides how it sits; null for the read's root. */
  element(
    layer: ReadLayer,
    model: ReadModel,
    parent: ReadLayer | null,
    assets: AssetPlan,
  ): LayerElement {
    const css = this.#css.read(layer, parent, model);
    const file = assets.file(layer.id);

    return {
      id: layer.id,
      tag: file === undefined ? this.#tags.of(layer.type) : ASSET_TAG[file.kind],
      attributes: this.#present([
        ...this.#metadata(layer, model),
        [DESIGN_ATTRIBUTE.textStyle, css.textStyle],
        [DESIGN_ATTRIBUTE.mask, layer.isMask ? (layer.maskType ?? BUILDER_VALUE.defaultMask).toLowerCase() : undefined],
        [DESIGN_ATTRIBUTE.src, file?.src],
        ...this.#path(layer),
        ...assets.css(layer, parent, css),
        // An asset's notes are about CSS its file now holds.
        ...this.#readOnly(layer, model, file === undefined ? css.notes : []),
      ]),
    };
  }

  /**
   * A hidden layer (D-18): what it is, not shown, and the property that shows it, so a bound visibility is seen; it
   * sends design_apply nothing to write.
   */
  stub(layer: ReadLayer): LayerElement {
    return {
      id: layer.id,
      tag: this.#tags.of(layer.type),
      attributes: this.#present([
        [DESIGN_ATTRIBUTE.id, layer.id],
        this.#name(layer),
        [DESIGN_ATTRIBUTE.display, BUILDER_VALUE.hidden],
        [DESIGN_ATTRIBUTE.visibleProp, this.#component.bound(layer, PROPERTY_FIELD.visible)],
      ]),
    };
  }

  #metadata(layer: ReadLayer, model: ReadModel): MaybeAttribute[] {
    const isText = Object.hasOwn(TEXT_TYPES, layer.type);
    const dev = layer === model.root && model.devStatus !== undefined ? DEV_STATUS_WORDS[model.devStatus] : undefined;

    return [
      [DESIGN_ATTRIBUTE.id, layer.id],
      this.#name(layer),
      ...this.#component.instance(layer),
      [DESIGN_ATTRIBUTE.description, layer.description === "" ? undefined : layer.description],
      [DESIGN_ATTRIBUTE.note, this.#note(layer)],
      [DESIGN_ATTRIBUTE.pins, this.#pins(layer)],
      [DESIGN_ATTRIBUTE.override, this.#component.override(layer)],
      [DESIGN_ATTRIBUTE.dev, dev],
      [DESIGN_ATTRIBUTE.href, layer.href ?? (isText ? this.#url(layer) : undefined)],
      ...this.#component.modes(layer),
    ];
  }

  /** A text on a path's path and start (T-140). */
  #path(layer: ReadLayer): MaybeAttribute[] {
    if (layer.textPath === undefined) {
      return [];
    }

    const { d, start } = this.#paths.read(layer.textPath);

    return [
      [DESIGN_ATTRIBUTE.d, d],
      [DESIGN_ATTRIBUTE.start, start],
    ];
  }

  #readOnly(
    layer: ReadLayer,
    model: ReadModel,
    notes: readonly CssDeclaration[],
  ): MaybeAttribute[] {
    return [
      [DESIGN_ATTRIBUTE.prop, this.#component.bound(layer, PROPERTY_FIELD.characters)],
      [DESIGN_ATTRIBUTE.visibleProp, this.#component.bound(layer, PROPERTY_FIELD.visible)],
      [DESIGN_ATTRIBUTE.swapProp, this.#component.bound(layer, PROPERTY_FIELD.mainComponent)],
      [
        DESIGN_ATTRIBUTE.css,
        notes.length === 0
          ? undefined
          : notes.map(([property, value]) => CSS_NOTES.line(property, value)).join(CSS_NOTES.separator),
      ],
      [DESIGN_ATTRIBUTE.gridStyle, layer.gridStyleId === undefined ? undefined : model.styles[layer.gridStyleId]?.name],
    ];
  }

  /** The layer's name; a Text's only when it differs from its characters, which the element already holds. */
  #name(layer: ReadLayer): MaybeAttribute {
    const repeatsText = Object.hasOwn(TEXT_TYPES, layer.type) && layer.name === layer.text?.characters;

    return [DESIGN_ATTRIBUTE.name, repeatsText ? undefined : layer.name];
  }

  /** The designer's Dev Mode notes, each with its category. */
  #note(layer: ReadLayer): string | undefined {
    const notes = (layer.annotations ?? []).flatMap(({ label, category }) =>
      label === undefined
        ? []
        : [(category === undefined ? label : NOTE.categorised(category, label)).replace(NOTE.marks, NOTE.escaped)],
    );

    return notes.length === 0 ? undefined : notes.join(NOTE.separator);
  }

  /** The properties pinned in the layer's annotations, in CSS words, in the order pinned, each once. */
  #pins(layer: ReadLayer): string | undefined {
    const isText = Object.hasOwn(TEXT_TYPES, layer.type);
    const words = new Set(
      (layer.annotations ?? []).flatMap(({ pins }) =>
        (pins ?? []).map((pin) => (isText ? TEXT_PIN_WORDS[pin] : undefined) ?? PIN_WORDS[pin] ?? pin),
      ),
    );

    return words.size === 0 ? undefined : [...words].join(PINS.separator);
  }

  /** The URL every run of a text links to, when they all link to the same one. */
  #url(layer: ReadLayer): string | undefined {
    const urls = new Set(
      (layer.text?.segments ?? []).map(({ hyperlink }) =>
        hyperlink?.type === BUILDER_VALUE.urlLink ? hyperlink.value : undefined,
      ),
    );
    const [url] = urls;

    return urls.size === 1 ? url : undefined;
  }

  #present(attributes: readonly MaybeAttribute[]): XmlAttribute[] {
    return attributes.filter((attribute): attribute is XmlAttribute => attribute[1] !== undefined);
  }
}

export const DESIGN_BUILDER = new InjectionToken<DesignBuilder>("DesignBuilder");
