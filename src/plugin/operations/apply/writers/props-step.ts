import { inject, injectable } from "@needle-di/core";
import { Closest } from "@/core/kernel/names/closest.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { COMPONENT_INDEX } from "@/plugin/adapters/figma/components/component-index.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { COMPONENT_PROPERTY_TYPE } from "@/plugin/adapters/figma/layer-meta/layer-meta.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { PROPS_VALUE, STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { PROPERTY_KEY } from "@/shared/read-model/read-model.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Wanted = Readonly<Record<string, string>>;

/** The properties of a component or an instance, each with its kind. */
type Definitions = Readonly<Record<string, { readonly type: ComponentPropertyType }>>;

/** What the props are checked against, and the name an error calls it by. */
interface Held {
  readonly name: string;
  readonly definitions: Definitions;
}

/**
 * An instance's properties by the names design_read writes, without Figma's #id (T-127): a text, "true" or "false", a
 * component's or set's name (or key:) for an instance swap. Figma retypes the texts a text property shows, so their
 * fonts load first, as for characters (B-028). A dry run checks their names, kinds and values against the component it finds by name.
 */
@injectable()
export class PropsStep implements WriteStep {
  readonly keys = STEP_KEYS.props;
  readonly capability = CAPABILITY.instance;
  readonly #closest = new Closest();
  readonly #components;
  readonly #factory;

  constructor(components = inject(COMPONENT_INDEX), factory = inject(LAYER_FACTORY)) {
    this.#components = components;
    this.#factory = factory;
  }

  /**
   * The names, kinds and values an instance's props must have, found without writing: against its new component's
   * definitions (found by name), else against the properties the instance has.
   */
  async check({ props, component }: FigmaProps, layer: TypedLayer): Promise<void> {
    const held = props === undefined ? null : await this.#held(layer, component);

    if (props !== undefined && held !== null) {
      for (const [name, key] of this.#keys(held.name, held.definitions, props)) {
        await this.#value(name, held.definitions[key]?.type, props[name] ?? "", false);
      }
    }
  }

  async write(node: SceneNode, { props = {} }: FigmaProps): Promise<void> {
    const instance = node as InstanceNode;
    const values: Record<string, string | boolean> = {};

    for (const [name, key] of this.#keys(instance.name, instance.componentProperties, props)) {
      values[key] = await this.#value(name, instance.componentProperties[key]?.type, props[name] ?? "", true);
    }

    await this.#loadShown(instance, Object.keys(values));
    instance.setProperties(values);
  }

  /**
   * The properties the instance will have: its component's by name when a dry run can look that up, else its own now.
   * shortcut: a component by `key:` (an import writes to the file) or one the call makes is not looked up in a dry run,
   * so a name or value wrong for it is refused by the write; upgrade when a dry run may import.
   */
  async #held(layer: TypedLayer, component: string | undefined): Promise<Held | null> {
    if (component !== undefined && this.#components.findable(component)) {
      try {
        const owner = await this.#components.find(component);

        return { name: owner.name, definitions: owner.componentPropertyDefinitions };
      } catch (error) {
        // The variant step refuses a component not found, once.
        if (error instanceof WriteError) {
          return null;
        }

        throw error;
      }
    }

    if ("componentProperties" in layer) {
      const instance = layer as InstanceNode;

      return { name: instance.name, definitions: instance.componentProperties };
    }

    return null;
  }

  /** Each wanted name with its key; an unknown name is refused with the names the instance (or its component) has. */
  #keys(
    label: string,
    definitions: Definitions,
    wanted: Wanted,
  ): [string, string][] {
    const keys = new Map(Object.keys(definitions).map((key) => [PROPERTY_KEY.name(key), key]));

    return Object.keys(wanted).map((name) => {
      const key = keys.get(name);

      if (key === undefined) {
        const near = this.#closest.of(name, keys.keys());
        const has = [...keys.keys()].join(PROPS_VALUE.listJoint);

        throw new WriteError(
          WRITERS_TEXT.noProperty(label, name, has),
          near === null ? undefined : WRITERS_TEXT.nearProperty(near),
        );
      }

      return [name, key];
    });
  }

  /**
   * A property's value as Figma takes it: a swap names a component by its id (a dry run looks up what it can without
   * importing), a boolean is true or false and nothing else.
   */
  async #value(
    name: string,
    type: ComponentPropertyType | undefined,
    value: string,
    writing: boolean,
  ): Promise<string | boolean> {
    if (type === COMPONENT_PROPERTY_TYPE.instanceSwap) {
      if (!writing && !this.#components.findable(value)) {
        return value;
      }

      const owner = await this.#components.find(value);

      return (owner.type === FIGMA_NODE_TYPE.componentSet ? owner.defaultVariant : owner).id;
    }

    if (type !== COMPONENT_PROPERTY_TYPE.boolean) {
      return value;
    }

    if (value !== PROPS_VALUE.trueValue && value !== PROPS_VALUE.falseValue) {
      throw new WriteError(WRITERS_TEXT.notBoolean(name, value));
    }

    return value === PROPS_VALUE.trueValue;
  }

  /** The fonts of the texts these properties show, loaded before Figma retypes them. */
  async #loadShown(node: InstanceNode, keys: readonly string[]): Promise<void> {
    const texts = node
      .findAllWithCriteria({ types: [FIGMA_NODE_TYPE.text] })
      .filter((text) => keys.includes(text.componentPropertyReferences?.characters ?? ""));

    await Promise.all(
      texts.flatMap((text) => this.#factory.textFonts(text)).map(async (font) => await this.#factory.loadFont(font)),
    );
  }
}
