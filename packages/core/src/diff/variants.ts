import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import type { VariantsView } from "../types/variants.ts";
import { designDiff } from "./design-diff.ts";

/** State values and the CSS pseudo-class each suggests. */
const PSEUDO: readonly [RegExp, string][] = [
  [/^hover(ed)?$/i, ":hover"],
  [/^(pressed|active|down)$/i, ":active"],
  [/^focus(ed)?$/i, ":focus-visible"],
  [/^disabled$/i, ":disabled"],
];

/**
 * A component set's variants against its default one (the top-left, as Figma takes it): what each changes, as
 * nodes_diff says it, with its properties and the pseudo-class a state value suggests.
 */
export function variantsView(snapshot: Snapshot): VariantsView {
  const variants = (snapshot.root.children ?? []).filter((child) => child.type === "COMPONENT");
  const [first] = variants.toSorted((a, b) => a.y - b.y || a.x - b.x);

  if (first === undefined) {
    throw new Error(`${snapshot.root.name} has no variants.`);
  }

  const properties: Record<string, string[]> = {};

  for (const variant of variants) {
    for (const [name, value] of Object.entries(propsOf(variant))) {
      properties[name] = [...new Set([...(properties[name] ?? []), value])];
    }
  }

  const of = (root: SnapshotNode): Snapshot => ({
    ...snapshot,
    root,
  });
  const base = propsOf(first);

  return {
    set: {
      id: snapshot.root.id,
      name: snapshot.root.name,
    },
    properties,
    default: {
      id: first.id,
      name: first.name,
    },
    variants: variants
      .filter((variant) => variant !== first)
      .map((variant) => {
        const diff = designDiff(of(first), of(variant));
        const props = propsOf(variant);
        const pseudo = Object.entries(props)
          .filter(([name, value]) => base[name] !== value)
          .map(([, value]) => PSEUDO.find(([pattern]) => pattern.test(value.trim()))?.[1])
          .find((found) => found !== undefined);

        return {
          id: variant.id,
          name: variant.name,
          props,
          ...(pseudo === undefined ? {} : { pseudo }),
          same: diff.same,
          changed: diff.changed,
          onlyInDefault: diff.onlyInA,
          onlyInVariant: diff.onlyInB,
        };
      }),
  };
}

/** A variant's properties from its name, as Figma writes it: "State=Hover, Size=Large". */
function propsOf(variant: SnapshotNode): Record<string, string> {
  return Object.fromEntries(
    variant.name
      .split(",")
      .map((part) => part.split("=").map((side) => side.trim()))
      .filter((pair): pair is [string, string] => pair.length === 2 && pair[0] !== "" && pair[1] !== undefined),
  );
}
