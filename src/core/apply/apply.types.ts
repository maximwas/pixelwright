import type { CHANGE_KIND } from "@/core/apply/apply.constants.ts";
import type { XML_NODE_KIND } from "@/core/xml/parse/parse.constants.ts";
import type { XmlLocation, XmlNode } from "@/core/xml/parse/parse.types.ts";
import type { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** An element of the parsed XML. */
export type ElementNode = Extract<XmlNode, { readonly kind: typeof XML_NODE_KIND.element }>;

/** A piece of a Text element's content as design_apply reads it, and where in the XML it starts. */
type TextPiece = { readonly kind: typeof XML_CONTENT.text; readonly value: string };

type SpanPiece = {
  readonly kind: typeof XML_CONTENT.span;
  readonly attributes: Readonly<Record<string, string>>;
  readonly value: string;
};

export type ContentPiece = XmlLocation & (TextPiece | SpanPiece);

/** One element of a design_apply XML: an existing layer to change (id) or a new one to create (ref "new:<line>"). */
export interface ApplyElement extends XmlLocation {
  readonly tag: string;
  readonly id: string | null;
  /** The layer's id, or the temporary one a create gets; children name their parent by it. */
  readonly ref: string;
  /** The parent element's ref; null at the top level. */
  readonly parent: string | null;
  /** Position among the parent's elements in the XML. */
  readonly index: number;
  /** Attributes as written, without the read-only $ ones and without those that were refused. */
  readonly attributes: Readonly<Record<string, string>>;
  /** A Text's content, piece by piece: its characters, and its spans' with what each sets. */
  readonly content?: ContentPiece[];
  /** Inside a copy or a new instance: the layer this element stands for, written onto its counterpart. */
  readonly source?: string;
  /** The ref of the copy or new instance the element is inside, however deep. */
  readonly copy?: string;
}

/** An error design_apply returns: where in the XML, on which layer and attribute, and what to do. */
export interface ApplyError extends XmlLocation {
  readonly id?: string;
  readonly attribute?: string;
  readonly message: string;
  readonly hint?: string;
}

/** What the reader answers: the elements read and every refusal; a parse error stops everything else. */
export interface ApplyReading {
  readonly elements: ApplyElement[];
  readonly errors: ApplyError[];
  /** The XML did not parse: errors holds that one fault, and the edge answers INVALID_XML. */
  readonly invalidXml: boolean;
}

/** One layer to create or change, in Figma's terms (C-171). */
export interface ApplyChange extends XmlLocation {
  readonly kind: (typeof CHANGE_KIND)[keyof typeof CHANGE_KIND];
  readonly ref: string;
  readonly id: string | null;
  readonly tag: string;
  readonly parent: string | null;
  readonly index: number;
  /** A top-level create placed next to an existing layer. */
  readonly before?: string;
  readonly after?: string;
  readonly props: FigmaProps;
  /** The attribute each property was read from, so the plugin's errors name it. */
  readonly sources: Readonly<Partial<Record<keyof FigmaProps, string>>>;
  /** A create that starts as a clone of this layer. */
  readonly copyOf?: string;
  /** Inside a copy or a new instance: the layer whose counterpart this change writes. */
  readonly source?: string;
  /** The copy or new instance the change is inside: its counterparts, and the layers before/after name, are there. */
  readonly copy?: string;
}
