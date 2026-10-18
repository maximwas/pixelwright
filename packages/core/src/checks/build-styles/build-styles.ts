import { COMPARISONS } from "./comparisons.ts";
import { designLonghands } from "./longhands.ts";
import type { StyleComparison } from "./schemas.ts";
import type { StyleLayer } from "./types.ts";

/**
 * A build's computed styles for one layer against the design's: each property the layer's attributes set (shorthands
 * spread into longhands, tokens and its text style in) is the same, different, left out by the build, or written in a
 * way a computed style cannot be held against. A size or a place may be off by `tolerance` px, since layout rounds it;
 * other lengths, colours and numbers compare as CSS computes them.
 */
export function styleMismatches(
  layer: StyleLayer,
  built: Readonly<Record<string, string>>,
  { tolerance }: { readonly tolerance: number },
): StyleComparison {
  const given = computedStyles(built);
  const mismatches: StyleComparison["mismatches"] = [];
  const notGiven: string[] = [];
  const notCompared: StyleComparison["notCompared"] = [];
  let matched = 0;

  for (const longhand of designLonghands(layer)) {
    const { property, design, from } = longhand;
    const { comparable, same } = COMPARISONS[longhand.kind];
    const build = given.get(property);

    if (comparable !== undefined && !comparable(longhand.value)) {
      notCompared.push({
        property,
        design,
      });
    } else if (build === undefined) {
      notGiven.push(property);
    } else if (same(longhand, build, tolerance)) {
      matched += 1;
    } else {
      mismatches.push({
        property,
        design,
        ...(from === undefined ? {} : { from }),
        build,
      });
    }
  }

  return {
    matched,
    mismatches,
    notGiven,
    notCompared,
  };
}

/** The build's styles by property as CSS spells them: backgroundColor, as a style object has it, is background-color. */
function computedStyles(built: Readonly<Record<string, string>>): Map<string, string> {
  return new Map(
    Object.entries(built).map(([name, value]) => [
      name.startsWith("--") ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      value.trim(),
    ]),
  );
}
