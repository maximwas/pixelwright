import type { FigmaProps, TextRunSpec } from "../css-mapping/figma-props.ts";
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
  /**
   * Inside a copy (copyOf) or a new instance: the layer this element stands for (the source's, or another instance's
   * of the same component), written onto its counterpart in the copy or the new instance.
   */
  readonly source?: string;
  /** The ref of the copy or new instance the element is inside, however deep. */
  readonly copy?: string;
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

/** What a layer has now, measured against an element (unchangedAttributes). */
export interface LayerNow {
  /** The element's attributes the layer already has, as design_read writes them: they are not written again. */
  readonly attributes: ReadonlySet<string>;
  /** Whether the layer's text already reads as the element's. */
  readonly text: boolean;
  /** Whether the layer is visible: a hidden one is shown again by a display other than none. */
  readonly visible: boolean;
  /** The layer's attributes as design_read writes them now: they complete what Figma keeps in one property. */
  readonly current: Readonly<Record<string, string>>;
}

/** One layer to create or change, in Figma's terms. */
export interface ApplyChange {
  readonly line: number;
  readonly column: number;
  readonly kind: "create" | "update";
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
  /** The characters and their runs, when the text changed or was restyled. */
  readonly text?: { readonly characters: string; readonly runs: readonly TextRunSpec[] };
  /** A create that starts as a clone of this layer. */
  readonly copyOf?: string;
  /** Inside a copy or a new instance: the layer whose counterpart this change writes. */
  readonly source?: string;
  /** The copy or new instance that counterpart is in. */
  readonly copy?: string;
  /** An update placed again, as a create is: another parent, before/after, or another order. */
  readonly move?: boolean;
}
