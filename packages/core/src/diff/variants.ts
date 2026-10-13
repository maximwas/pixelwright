import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import type { VariantsView } from "../types/variants.ts";
import { designDiff } from "./design-diff.ts";

/** The most variants one answer compares, and the most differences listed per list. */
const VARIANTS_MAX = 50;
const DIFF_MAX = 100;

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
  const others = variants.filter((variant) => variant !== first);

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
    variants: others.slice(0, VARIANTS_MAX).map((variant) => {
      const props = propsOf(variant);
      const against = baselineOf(variant, props, variants, base) ?? first;
      const diff = designDiff(of(against), of(variant));
      const pseudo = Object.entries(props)
        .filter(([name, value]) => propsOf(against)[name] !== value)
        .map(([, value]) => pseudoOf(value))
        .find((found) => found !== undefined);

      return {
        id: variant.id,
        name: variant.name,
        props,
        against: {
          id: against.id,
          name: against.name,
        },
        ...(pseudo === undefined ? {} : { pseudo }),
        same: diff.same,
        changed: diff.changed.slice(0, DIFF_MAX),
        onlyInDefault: diff.onlyInA.slice(0, DIFF_MAX),
        onlyInVariant: diff.onlyInB.slice(0, DIFF_MAX),
      };
    }),
    ...(others.length > VARIANTS_MAX ? { more: others.length - VARIANTS_MAX } : {}),
  };
}

/**
 * The variant to compare one with: the one it differs from in a single property, set there as on the default, a
 * state first (Size=Large, State=Hover against Size=Large, State=Default). None such: the default.
 */
function baselineOf(
  variant: SnapshotNode,
  props: Readonly<Record<string, string>>,
  variants: readonly SnapshotNode[],
  base: Readonly<Record<string, string>>,
): SnapshotNode | undefined {
  const candidates = variants.flatMap((other) => {
    if (other === variant) {
      return [];
    }

    const theirs = propsOf(other);
    const apart = Object.keys({
      ...props,
      ...theirs,
    }).filter((name) => props[name] !== theirs[name]);
    const [only] = apart;

    return apart.length === 1 && only !== undefined && theirs[only] === base[only]
      ? [
          {
            other,
            state: pseudoOf(props[only] ?? "") !== undefined,
          },
        ]
      : [];
  });

  return (candidates.find((candidate) => candidate.state) ?? candidates[0])?.other;
}

function pseudoOf(value: string): string | undefined {
  return PSEUDO.find(([pattern]) => pattern.test(value.trim()))?.[1];
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
