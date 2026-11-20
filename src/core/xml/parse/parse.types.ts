import type { XML_NODE_KIND } from "@/core/xml/parse/parse.constants.ts";

/** Where something is written: lines and columns count from 1. */
export interface XmlLocation {
  readonly line: number;
  readonly column: number;
}

interface XmlTextNode extends XmlLocation {
  readonly kind: typeof XML_NODE_KIND.text;
  readonly value: string;
}

interface XmlElementNode extends XmlLocation {
  readonly kind: typeof XML_NODE_KIND.element;
  readonly type: string;
  readonly props: Readonly<Record<string, string>>;
  readonly children: readonly XmlNode[];
}

/** One text piece per run of characters: CDATA and the text around it stay apart (C-005). */
export type XmlNode = XmlTextNode | XmlElementNode;

/** Why the XML is wrong and where; the message starts with the place, for the model. */
export interface XmlProblem extends XmlLocation {
  readonly message: string;
}

/** Errors are values: the edge turns them into INVALID_XML. */
export type XmlParseResult =
  | { readonly ok: true; readonly nodes: readonly XmlNode[] }
  | { readonly ok: false; readonly error: XmlProblem };
