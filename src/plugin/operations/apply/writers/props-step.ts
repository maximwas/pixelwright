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

/**
 * An instance's properties by the names design_read writes, without Figma's #id (T-127): a text, "true" or "false", a
 * component's or set's name (or key:) for an instance swap. Figma retypes the texts a text property shows, so their
 * fonts load first, as for characters (B-028). A dry run checks the names alone.
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

  check({ props }: FigmaProps, layer: TypedLayer): void {
    if (props !== undefined && "componentProperties" in layer) {
      this.#keys(layer as InstanceNode, props);
    }
  }

  async write(node: SceneNode, { props = {} }: FigmaProps): Promise<void> {
    const instance = node as InstanceNode;
    const values: Record<string, string | boolean> = {};

    for (const [name, key] of this.#keys(instance, props)) {
      values[key] = await this.#value(instance.componentProperties[key]?.type, props[name] ?? "");
    }

    await this.#loadShown(instance, Object.keys(values));
    instance.setProperties(values);
  }

  /** Each wanted name with its key on the instance; an unknown name is refused with the names it has. */
  #keys(node: InstanceNode, wanted: Wanted): [string, string][] {
    const keys = new Map(Object.keys(node.componentProperties).map((key) => [PROPERTY_KEY.name(key), key]));

    return Object.keys(wanted).map((name) => {
      const key = keys.get(name);

      if (key === undefined) {
        const near = this.#closest.of(name, keys.keys());
        const has = [...keys.keys()].join(PROPS_VALUE.listJoint);

        throw new WriteError(
          WRITERS_TEXT.noProperty(node.name, name, has),
          near === null ? undefined : WRITERS_TEXT.nearProperty(near),
        );
      }

      return [name, key];
    });
  }

  /** A property's value as Figma takes it: a swap names a component by its id, a boolean is true or false. */
  async #value(type: ComponentPropertyType | undefined, value: string): Promise<string | boolean> {
    if (type === COMPONENT_PROPERTY_TYPE.instanceSwap) {
      const owner = await this.#components.find(value);

      return (owner.type === FIGMA_NODE_TYPE.componentSet ? owner.defaultVariant : owner).id;
    }

    return type === COMPONENT_PROPERTY_TYPE.boolean ? value === PROPS_VALUE.trueValue : value;
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
