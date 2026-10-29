import type { XML_CONTENT } from "@/core/xml/xml.constants.ts";

/** An attribute as written: its name and its value, unescaped. */
export type XmlAttribute = readonly [name: string, value: string];

/** A piece of a Text's content: plain characters, or a Span with what it sets over the text's own. */
export type XmlContent =
  | { readonly kind: typeof XML_CONTENT.text; readonly value: string }
  | { readonly kind: typeof XML_CONTENT.span; readonly attributes: readonly XmlAttribute[]; readonly value: string };

/**
 * The element written for one layer (C-140): its layer's id, its tag, its attributes in order, and a Text's content
 * (null for any other element) or its children. Every consumer works on this tree; the XML is written last.
 */
export interface XmlElement {
  readonly id: string;
  readonly tag: string;
  readonly attributes: readonly XmlAttribute[];
  readonly content: readonly XmlContent[] | null;
  readonly children: readonly XmlElement[];
}
