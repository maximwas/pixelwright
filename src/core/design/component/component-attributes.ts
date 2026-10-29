import { InjectionToken, inject, injectable } from "@needle-di/core";
import { BUILDER_VALUE } from "@/core/design/builder/builder.constants.ts";
import {
  MODE_ATTRIBUTE,
  OVERRIDE,
  OVERRIDE_NOISE,
  OVERRIDE_ORDER,
  OVERRIDE_WORDS,
  PROPERTY_NAME,
  PROPERTY_TYPES,
  TEXT_OVERRIDE_WORDS,
} from "@/core/design/component/component.constants.ts";
import { DESIGN_ATTRIBUTE, TEXT_TYPES } from "@/core/design/design.constants.ts";
import type { MaybeAttribute } from "@/core/design/design.types.ts";
import { NAME_VALUE_LIST } from "@/core/kernel/lists/name-value-list.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type InstanceProperties = NonNullable<ReadLayer["instance"]>["properties"];

/**
 * What a layer is as a component's part: an instance's component, variant and props (C-136, K-069), what it overrode
 * (C-133), the properties a component's layer is bound to, and the variable modes set on it (C-135).
 */
@injectable()
export class ComponentAttributes {
  readonly #lists;

  constructor(lists = inject(NAME_VALUE_LIST)) {
    this.#lists = lists;
  }

  /** An instance's component (its set's name for a variant), its variant values, its own properties, its exposure. */
  instance(layer: ReadLayer): MaybeAttribute[] {
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

  /** What an instance changed on this layer outside its component's properties, in CSS words, each once, in one order. */
  override(layer: ReadLayer): string | undefined {
    const isText = Object.hasOwn(TEXT_TYPES, layer.type);
    const words = new Set(
      (layer.overrides ?? [])
        .filter((field) => !Object.hasOwn(OVERRIDE_NOISE, field))
        .map((field) => (isText ? TEXT_OVERRIDE_WORDS[field] : undefined) ?? OVERRIDE_WORDS[field] ?? field),
    );
    const sorted = [...words].sort((first, second) => this.#rank(first) - this.#rank(second));

    return sorted.length === 0 ? undefined : sorted.join(OVERRIDE.separator);
  }

  /** The variable modes set on the layer, as the data attributes tokens_read's CSS selects on. */
  modes(layer: ReadLayer): MaybeAttribute[] {
    return (layer.modes ?? []).map(({ collection, mode }) => [
      MODE_ATTRIBUTE.name(this.#slug(collection)),
      this.#slug(mode),
    ]);
  }

  /** The component property the layer's field is bound to, by its bare name. */
  bound(layer: ReadLayer, field: string): string | undefined {
    const reference = layer.componentPropertyReferences?.[field];

    return reference === undefined ? undefined : this.#bareName(reference);
  }

  /** The properties of the given types as a `Name=Value, …` list (K-069), names bare. */
  #properties(properties: InstanceProperties, types: Readonly<Record<string, string>>): string {
    const listed = Object.entries(properties)
      .filter(([, property]) => Object.hasOwn(types, property.type))
      .map(([name, property]) => [this.#bareName(name), String(property.value)]);

    return this.#lists.write(Object.fromEntries(listed));
  }

  #bareName(key: string): string {
    return key.replace(PROPERTY_NAME.idSuffix, "");
  }

  #rank(word: string): number {
    const at = OVERRIDE_ORDER.indexOf(word);

    return at === -1 ? OVERRIDE_ORDER.length : at;
  }

  #slug(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(MODE_ATTRIBUTE.other, MODE_ATTRIBUTE.dash)
      .replace(MODE_ATTRIBUTE.edges, "");

    return slug === "" ? MODE_ATTRIBUTE.empty : slug;
  }
}

export const COMPONENT_ATTRIBUTES = new InjectionToken<ComponentAttributes>("ComponentAttributes");
