/** Where something starts in the XML source, for error messages. Lines and columns count from 1. */
export interface XmlLocation {
  readonly line: number;
  readonly column: number;
}

export interface XmlElementNode extends XmlLocation {
  readonly kind: "element";
  readonly type: string;
  /** Attribute values with entities decoded. */
  readonly props: Readonly<Record<string, string>>;
  readonly children: readonly XmlChild[];
}

/** Text between tags, entities decoded, with indentation whitespace already dropped. */
export interface XmlTextNode extends XmlLocation {
  readonly kind: "text";
  readonly value: string;
}

export type XmlChild = XmlElementNode | XmlTextNode;
