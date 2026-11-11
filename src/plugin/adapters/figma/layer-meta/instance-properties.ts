import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { COMPONENT_PROPERTY_TYPE } from "@/plugin/adapters/figma/layer-meta/layer-meta.constants.ts";
import { PROPERTY_KEY } from "@/shared/read-model/read-model.constants.ts";

/** A component property's value: a text, a boolean, a variant's value or a swap's component id. */
export type PropertyValue = string | boolean;

/**
 * An instance's component properties against its component's defaults: a variant's from its set's default variant,
 * the others from the definitions (read on the set for a variant, since a variant's own throw, FX-028).
 */
export class InstanceProperties {
  /**
   * Each property's default, keyed as the instance's componentProperties; none when Figma cannot read them: a remote
   * component it cannot load throws on its definitions, or on its set's default variant.
   */
  defaults(main: ComponentNode): Record<string, PropertyValue> {
    const set = main.parent?.type === FIGMA_NODE_TYPE.componentSet ? main.parent : null;

    try {
      const variant = set?.defaultVariant.variantProperties ?? {};

      return Object.fromEntries(
        Object.entries((set ?? main).componentPropertyDefinitions).flatMap(([key, { type, defaultValue }]) => {
          const value = type === COMPONENT_PROPERTY_TYPE.variant ? (variant[key] ?? defaultValue) : defaultValue;

          return typeof value === "string" || typeof value === "boolean" ? [[key, value]] : [];
        }),
      );
    } catch {
      return {};
    }
  }

  /** Every property's value on the instance, by name without Figma's #id. */
  values(node: InstanceNode): Record<string, PropertyValue> {
    return Object.fromEntries(
      Object.entries(node.componentProperties).flatMap(([key, { value }]) =>
        typeof value === "string" || typeof value === "boolean" ? [[PROPERTY_KEY.name(key), value]] : [],
      ),
    );
  }

  /** The properties whose value differs from the default, by name without Figma's #id. */
  changed(node: InstanceNode, main: ComponentNode): Record<string, PropertyValue> {
    const defaults = this.defaults(main);

    return Object.fromEntries(
      Object.entries(node.componentProperties).flatMap(([key, { value }]) =>
        Object.hasOwn(defaults, key) && defaults[key] !== value ? [[PROPERTY_KEY.name(key), value]] : [],
      ),
    );
  }
}
