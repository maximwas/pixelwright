import { InjectionToken, injectable } from "@needle-di/core";
import { COMPONENT_TEXT, COMPONENT_VALUE } from "@/plugin/adapters/figma/components/components.constants.ts";
import type { ComponentOwner } from "@/plugin/adapters/figma/components/components.types.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";

type Values = Readonly<Record<string, string>>;

/**
 * A set's variants by their values (P-084): what holds a component's properties, a variant's values and its name as
 * Figma writes them, and the variant an instance is made of, the values left out its set's default variant's.
 */
@injectable()
export class Variants {
  /** A variant's set, or the lone component itself. */
  owner(main: ComponentNode): ComponentOwner {
    return main.parent?.type === FIGMA_NODE_TYPE.componentSet ? main.parent : main;
  }

  /** A variant's values as Figma gives them; a component outside a set has none. */
  values(component: ComponentNode): Record<string, string> {
    return { ...(component.variantProperties ?? {}) };
  }

  /** A variant's name as Figma writes it: "Size=Large, State=Default". */
  name(values: Values): string {
    return Object.entries(values)
      .map(([name, value]) => COMPONENT_VALUE.variantPair(name, value))
      .join(COMPONENT_VALUE.variantJoint);
  }

  /** The component an instance is made of: a lone one, or the set's variant with these values (the rest its default's). */
  of(owner: ComponentOwner, wanted: Values): ComponentNode {
    if (owner.type === FIGMA_NODE_TYPE.component) {
      if (Object.keys(wanted).length > 0) {
        throw new WriteError(COMPONENT_TEXT.noVariants(owner.name));
      }

      return owner;
    }

    const target = { ...this.values(owner.defaultVariant), ...wanted };
    const variants = owner.children.filter((child): child is ComponentNode => child.type === FIGMA_NODE_TYPE.component);
    const found = variants.find((variant) =>
      Object.entries(target).every(([name, value]) => variant.variantProperties?.[name] === value),
    );

    if (found === undefined) {
      const has = variants.map(({ name }) => name).join(COMPONENT_VALUE.variantsJoint);

      throw new WriteError(COMPONENT_TEXT.noVariant(owner.name, this.name(wanted), has));
    }

    return found;
  }
}

export const VARIANTS = new InjectionToken<Variants>("Variants");
