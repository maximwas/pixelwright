import type { DesignAttribute } from "../../design/tree.ts";

/**
 * How a design value is compared with a computed one: a size or a place (layout rounds it), another length, a colour,
 * a keyword, a font family, a number, a shadow list, background images, a transform, grid tracks; or one this check
 * cannot read.
 */
export type LonghandKind =
  | "box"
  | "length"
  | "color"
  | "keyword"
  | "family"
  | "number"
  | "shadows"
  | "images"
  | "transform"
  | "tracks"
  | "unread";

/** One computed property a design attribute sets. */
export interface Longhand {
  readonly property: string;
  readonly kind: LonghandKind;
  /** The value compared: its tokens' values in, em at the font's size in px. */
  readonly value: string;
  /** The value as the design writes it, its tokens' values in. */
  readonly design: string;
  /** What it comes from when the layer does not write it out: a var(), a textStyle. */
  readonly from?: string;
}

/** A layer as design_read writes it: its attributes, and the tokens and text styles the read names. */
export interface StyleLayer {
  readonly attributes: readonly DesignAttribute[];
  readonly tokens: Readonly<Record<string, string>>;
  readonly textStyles: Readonly<Record<string, string>>;
}
