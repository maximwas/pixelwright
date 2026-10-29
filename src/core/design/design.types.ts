import type { RepeatRead } from "@/core/design/repeats/repeats.types.ts";
import type { XmlElement, XmlSpan } from "@/core/xml/xml.types.ts";

/** design_read's XML with the layers it cut (`$children`, `$truncated`) and, when asked, its folded runs. */
export interface XmlRead {
  readonly xml: string;
  readonly truncated: string[];
  readonly repeats?: readonly RepeatRead[];
}

/** A read with the lines it is made of and where each layer sits in them: the fit measures branches with them. */
export interface RenderedDesign {
  readonly read: XmlRead;
  /** The tree as built, before runs fold: the hints read its attributes. */
  readonly tree: XmlElement | null;
  readonly lines: readonly string[];
  readonly spans: ReadonlyMap<string, XmlSpan>;
}

/** An attribute, or nothing when the layer has none of it. */
export type MaybeAttribute = readonly [name: string, value: string | undefined];
