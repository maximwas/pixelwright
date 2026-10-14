import type { FigmaProps } from "../types/apply.ts";
import type { Rule } from "./property-group.ts";

/** A rule that writes a CSS keyword as the Figma value its table gives it; any other value is the attribute's error. */
export function keywordRule<K extends keyof FigmaProps>(
  attribute: string,
  table: Readonly<Record<string, Exclude<FigmaProps[K], undefined>>>,
  key: K,
): Rule["write"] {
  return ({ own }, out) => {
    const value = own(attribute) ?? "";
    const mapped = table[value];

    if (mapped === undefined) {
      out.fail(attribute, `${attribute}="${value}" is not one Figma has: ${Object.keys(table).join(", ")}.`);
    } else {
      out.set(key, mapped, attribute);
    }
  };
}
