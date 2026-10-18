import { dimensionOf, splitTop } from "../../css-mapping/values/css-values.ts";
import { CSS_ATTRIBUTES } from "../../css-mapping/vocabulary.ts";
import { decimal } from "../../kernel/numbers.ts";
import { DesignValues } from "./design-values.ts";
import { expanded } from "./expanders.ts";
import type { Longhand, StyleLayer } from "./types.ts";

/**
 * The computed properties a layer's attributes set, in its attributes' order: its text style's first and its own over
 * them, as CSS cascades them; a length in em at the font's size in px.
 */
export function designLonghands({ attributes, tokens, textStyles }: StyleLayer): Longhand[] {
  const values = new DesignValues(tokens);
  const longhands = new Map<string, Longhand>();

  for (const [name, written] of attributes) {
    const set =
      name === "textStyle"
        ? styleLonghands(written, textStyles, values)
        : CSS_ATTRIBUTES.has(name)
          ? expanded(name, written, values)
          : [];

    for (const longhand of set) {
      // An own value over its style's keeps the style's place in the list.
      longhands.set(longhand.property, longhand);
    }
  }

  return inPixels([...longhands.values()]);
}

/** What a text style sets: its font shorthand and the declarations after it, each said to come from the style. */
function styleLonghands(name: string, textStyles: StyleLayer["textStyles"], values: DesignValues): Longhand[] {
  const [font, ...declarations] = splitTop(textStyles[name] ?? "", ";");
  const from = `textStyle="${name}"`;
  const set = [
    ...(font === undefined ? [] : expanded("font", font, values)),
    ...declarations.flatMap((declaration) => {
      const colon = declaration.indexOf(":");

      return colon === -1
        ? []
        : expanded(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim(), values);
    }),
  ];

  return set.map((longhand) => ({
    ...longhand,
    from: longhand.from ?? from,
  }));
}

/** Lengths in em at the font's size in px, as a computed style holds them; without a size in px they stay em. */
function inPixels(longhands: readonly Longhand[]): Longhand[] {
  const size = dimensionOf(longhands.find(({ property }) => property === "font-size")?.value ?? "");

  return longhands.map((longhand) => {
    const length = longhand.kind === "length" ? dimensionOf(longhand.value) : null;

    return length?.unit === "em" && size?.unit === "px"
      ? {
          ...longhand,
          value: `${decimal(length.value * size.value)}px`,
        }
      : longhand;
  });
}
