import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

/** What a Span writes when the text it sits in has a property it lacks. */
export const SPAN_RESETS: Readonly<Record<string, string>> = {
  [CSS_PROPERTY.letterSpacing]: "0",
  [CSS_PROPERTY.textTransform]: "none",
  [CSS_PROPERTY.textDecoration]: "none",
};

export const TEXT_PARTS = {
  ellipsis: "…",
  urlLink: "URL",
  textStyle: "textStyle",
  href: "href",
  textStyleType: "TEXT",
  /** Weights sort as numbers: 500 before 1000, "500 italic" after 500. */
  locale: "en",
  declarations: "; ",
} as const;

export const CATALOGUE_TEXT = {
  weight: (weight: number, italic: boolean) => `${weight}${italic ? " italic" : ""}`,
  declaration: (property: string, value: string) => `${property}: ${value}`,
} as const;

/** A token the XML names: `var(--name)`, a fallback after its comma. */
export const TOKEN_USE = /var\((--[^),\s]+)/g;

/** The variable and style kinds a read's tokens hold a value for (T-163); text styles go to textStyles. */
export const TOKEN_KIND = { color: "COLOR", solid: "SOLID", paint: "PAINT", effect: "EFFECT" } as const;
