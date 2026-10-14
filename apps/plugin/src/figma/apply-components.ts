import type { FigmaProps } from "@pixelwright/core";
import { SET_GAP } from "../constants/plugin.ts";
import type { Layer } from "../types/apply.ts";
import { type ComponentOwner, ownerOf, valuesOf, variantName } from "./variants.ts";
import { WriteError } from "./write-error.ts";

type Owner = ComponentOwner;

/**
 * Properties a new component's layers make, bound once the component (or the set it joined) is complete: one the
 * component or set has by that name and type already (a copy's, another variant's) is bound, never made twice.
 */
export function bindProperties(
  marks: readonly { node: Layer; property: NonNullable<FigmaProps["property"]>; fail: (error: unknown) => void }[],
): void {
  const keyFor = (owner: Owner, name: string, type: "TEXT" | "BOOLEAN", fallback: string | boolean) => {
    const definitions = owner.componentPropertyDefinitions;
    const found = Object.keys(definitions).find(
      (key) => key.replace(/#[^#]*$/, "") === name && definitions[key]?.type === type,
    );

    return found ?? owner.addComponentProperty(name, type, fallback);
  };

  for (const { node, property, fail } of marks) {
    try {
      let component: BaseNode | null = node.parent as unknown as BaseNode | null;

      while (component !== null && component.type !== "COMPONENT") {
        component = component.parent;
      }

      if (component === null) {
        throw new WriteError("prop and visibleProp make a property of the new <Component> holding the layer.");
      }

      const owner = ownerOf(component as ComponentNode);
      const references: Record<string, string> = {
        ...((node.componentPropertyReferences as Record<string, string> | null) ?? {}),
      };

      if (property.text !== undefined) {
        if (node.type !== "TEXT") {
          throw new WriteError("prop makes a text property: it goes on a <Text>.", "Use visibleProp on other layers.");
        }

        references.characters = keyFor(owner, property.text, "TEXT", String(node.characters ?? ""));
      }

      if (property.visible !== undefined) {
        references.visible = keyFor(owner, property.visible, "BOOLEAN", true);
      }

      node.componentPropertyReferences = references;
    } catch (error) {
      fail(error);
    }
  }
}

/** A set's variants in a grid: a column per value of its first variant property, a row per the rest. */
export function layOut(set: ComponentSetNode): void {
  const variants = set.children.filter((child): child is ComponentNode => child.type === "COMPONENT");
  const [first] = Object.keys(set.componentPropertyDefinitions).filter(
    (name) => set.componentPropertyDefinitions[name]?.type === "VARIANT",
  );
  const columns = [...new Set(variants.map((variant) => valuesOf(variant)[first ?? ""] ?? ""))];
  const rest = (variant: ComponentNode) =>
    variantName(Object.fromEntries(Object.entries(valuesOf(variant)).filter(([name]) => name !== first)));
  const rows = [...new Set(variants.map(rest))];
  const width = Math.max(...variants.map((variant) => variant.width));
  const height = Math.max(...variants.map((variant) => variant.height));

  for (const variant of variants) {
    variant.x = SET_GAP + columns.indexOf(valuesOf(variant)[first ?? ""] ?? "") * (width + SET_GAP);
    variant.y = SET_GAP + rows.indexOf(rest(variant)) * (height + SET_GAP);
  }

  set.resizeWithoutConstraints(
    SET_GAP + columns.length * (width + SET_GAP),
    SET_GAP + rows.length * (height + SET_GAP),
  );
}
