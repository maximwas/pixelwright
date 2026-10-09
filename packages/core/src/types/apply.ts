import type { XmlChild } from "./xml.ts";

/** One element of a design_apply XML: an existing layer to change (id) or a new one to create (ref "new:<line>"). */
export interface ApplyElement {
  readonly line: number;
  readonly column: number;
  readonly tag: string;
  readonly id: string | null;
  /** The layer's id, or the temporary one a create gets; children name their parent by it. */
  readonly ref: string;
  /** The parent element's ref; null at the top level (the tool's parent, or where before/after say). */
  readonly parent: string | null;
  /** Position among the parent's elements in the XML. */
  readonly index: number;
  /** Attributes as written, without the read-only $ ones and without those that were refused. */
  readonly attributes: Readonly<Record<string, string>>;
  /** A Text's content: text and Span elements, as parsed. */
  readonly content?: readonly XmlChild[];
}

/** An error design_apply returns: where in the XML, on which layer and attribute, and what to do. */
export interface ApplyError {
  readonly line: number;
  readonly column: number;
  readonly id?: string;
  readonly attribute?: string;
  readonly message: string;
  readonly hint?: string;
}
