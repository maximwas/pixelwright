import { valuesOf, variantName } from "../../figma/variants.ts";

/** Room around and between a new component set's variants. */
export const SET_GAP = 40;

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
