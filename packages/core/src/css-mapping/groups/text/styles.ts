import type { SnapshotStyle } from "../../../types/snapshot.ts";
import { fontShorthand, letterSpacingCss } from "../../values/fonts.ts";

/** Figma's text case as text-transform; ORIGINAL is the default and left out (small caps are no transform). */
export const CASE_CSS: Readonly<Record<string, string>> = {
  UPPER: "uppercase",
  LOWER: "lowercase",
  TITLE: "capitalize",
};

/** A text style as the textStyles map shows it: its font shorthand plus its spacing and case. */
export function textStyleCss(style: SnapshotStyle): string | null {
  if (style.fontName === undefined || style.fontSize === undefined || style.lineHeight === undefined) {
    return null;
  }

  return [
    fontShorthand({
      fontName: style.fontName,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
    }),
    ...textStyleExtras(style).map(([property, value]) => `${property}: ${value}`),
  ].join("; ");
}

/** What a text style sets besides its font, when not the default: letter spacing and case. */
export function textStyleExtras(style: SnapshotStyle): [string, string][] {
  const spacing = style.letterSpacing === undefined ? null : letterSpacingCss(style.letterSpacing);
  const transform = style.textCase === undefined ? undefined : CASE_CSS[style.textCase];

  return [
    ...(spacing === null ? [] : [["letter-spacing", spacing] as [string, string]]),
    ...(transform === undefined ? [] : [["text-transform", transform] as [string, string]]),
  ];
}
