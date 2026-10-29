import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_READER } from "@/core/css/css-reader.ts";
import type { CssDeclaration } from "@/core/css/registry/css-declarations.ts";
import {
  BUILDER_VALUE,
  CSS_NOTES,
  DEV_STATUS_WORDS,
  NOTE,
  PROPERTY_FIELD,
  PROPERTY_NAME,
  PROPERTY_TYPES,
} from "@/core/design/builder/builder.constants.ts";
import { DESIGN_ATTRIBUTE, TEXT_TYPES } from "@/core/design/design.constants.ts";
import { NAME_VALUE_LIST } from "@/core/kernel/lists/name-value-list.ts";
import { NODE_TAG } from "@/core/xml/node-tag.ts";
import type { XmlAttribute, XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer's element before its content or children: its id, its tag and its attributes. */
type LayerElement = Pick<XmlElement, "id" | "tag" | "attributes">;

/** An attribute, or nothing when the layer has none of it. */
type MaybeAttribute = readonly [name: string, value: string | undefined];

type InstanceProperties = NonNullable<ReadLayer["instance"]>["properties"];

/**
 * A layer's element as design_read writes it: Figma's type as its tag and its attributes in C-1.3 order, what the layer
 * is (id, name, component, notes, status, link, mask), its CSS in CSS_ORDER, then the read-only `$` attributes (the
 * component properties it is bound to, the CSS it cannot write back as `$css`, its grid style).
 */
@injectable()
export class DesignBuilder {
  readonly #tags;
  readonly #lists;
  readonly #css;

  constructor(
    tags = inject(NODE_TAG),
    lists = inject(NAME_VALUE_LIST),
    css = inject(CSS_READER),
  ) {
    this.#tags = tags;
    this.#lists = lists;
    this.#css = css;
  }

  /** `parent`: the layer's parent in the read, which decides how it sits; null for the read's root. */
  element(
    layer: ReadLayer,
    model: ReadModel,
    parent: ReadLayer | null,
  ): LayerElement {
    const css = this.#css.read(layer, parent, model);

    return {
      id: layer.id,
      tag: this.#tags.of(layer.type),
      attributes: this.#present([
        ...this.#metadata(layer, model),
        ...css.properties,
        ...this.#readOnly(layer, model, css.notes),
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
        [DESIGN_ATTRIBUTE.visibleProp, this.#property(layer, PROPERTY_FIELD.visible)],
      ]),
    };
  }

  #metadata(layer: ReadLayer, model: ReadModel): MaybeAttribute[] {
    const isText = Object.hasOwn(TEXT_TYPES, layer.type);
    const dev = layer === model.root && model.devStatus !== undefined ? DEV_STATUS_WORDS[model.devStatus] : undefined;

    return [
      [DESIGN_ATTRIBUTE.id, layer.id],
      this.#name(layer),
      ...this.#component(layer),
      [DESIGN_ATTRIBUTE.description, layer.description === "" ? undefined : layer.description],
      [DESIGN_ATTRIBUTE.note, this.#note(layer)],
      [DESIGN_ATTRIBUTE.dev, dev],
      [DESIGN_ATTRIBUTE.href, layer.href ?? (isText ? this.#url(layer) : undefined)],
      [DESIGN_ATTRIBUTE.mask, layer.isMask ? (layer.maskType ?? BUILDER_VALUE.defaultMask).toLowerCase() : undefined],
    ];
  }

  #readOnly(
    layer: ReadLayer,
    model: ReadModel,
    notes: readonly CssDeclaration[],
  ): MaybeAttribute[] {
    return [
      [DESIGN_ATTRIBUTE.prop, this.#property(layer, PROPERTY_FIELD.characters)],
      [DESIGN_ATTRIBUTE.visibleProp, this.#property(layer, PROPERTY_FIELD.visible)],
      [DESIGN_ATTRIBUTE.swapProp, this.#property(layer, PROPERTY_FIELD.mainComponent)],
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

  /** An instance's component (its set's name for a variant), its variant values, its own properties, its exposure. */
  #component(layer: ReadLayer): MaybeAttribute[] {
    if (layer.instance === undefined) {
      return [];
    }

    const { setName, componentName, properties, exposed } = layer.instance;
    const variant = this.#properties(properties, PROPERTY_TYPES.variant);
    const props = this.#properties(properties, PROPERTY_TYPES.own);

    return [
      [DESIGN_ATTRIBUTE.component, setName ?? componentName],
      [DESIGN_ATTRIBUTE.variant, setName === undefined || variant === "" ? undefined : variant],
      [DESIGN_ATTRIBUTE.props, props === "" ? undefined : props],
      [DESIGN_ATTRIBUTE.exposed, exposed ? BUILDER_VALUE.on : undefined],
    ];
  }

  /** The properties of the given types as a `Name=Value, …` list (K-069), names bare. */
  #properties(properties: InstanceProperties, types: Readonly<Record<string, string>>): string {
    const listed = Object.entries(properties)
      .filter(([, property]) => Object.hasOwn(types, property.type))
      .map(([name, property]) => [this.#bareName(name), String(property.value)]);

    return this.#lists.write(Object.fromEntries(listed));
  }

  /** The component property the layer's field is bound to, by its bare name. */
  #property(layer: ReadLayer, field: string): string | undefined {
    const reference = layer.componentPropertyReferences?.[field];

    return reference === undefined ? undefined : this.#bareName(reference);
  }

  #bareName(key: string): string {
    return key.replace(PROPERTY_NAME.idSuffix, "");
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
