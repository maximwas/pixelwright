import type { LONGHAND_KIND } from "@/core/checks/build-styles/build-styles.constants.ts";
import type { CssDeclaration } from "@/core/css/registry/css-declarations.ts";

export type LonghandKind = (typeof LONGHAND_KIND)[keyof typeof LONGHAND_KIND];

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

/** A layer as design_read writes it: its CSS, its text style's name, and the read's tokens and text styles. */
export interface StyleLayer {
  readonly declarations: readonly CssDeclaration[];
  readonly textStyle: string | undefined;
  readonly tokens: Readonly<Record<string, string>>;
  readonly textStyles: Readonly<Record<string, string>>;
}

/** A layer and the build's computed styles for it, by property. */
export interface StylePair {
  readonly node: string;
  readonly css: Readonly<Record<string, string>>;
  readonly label?: string;
}
