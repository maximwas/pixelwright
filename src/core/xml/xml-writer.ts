import { InjectionToken, inject, injectable } from "@needle-di/core";
import { XML, XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { XmlAttribute, XmlContent, XmlElement } from "@/core/xml/xml.types.ts";
import { XML_ESCAPE } from "@/core/xml/xml-escape.ts";

/**
 * A tree as light XML (C-1.1): an element per line, or a pair of lines around its children, two spaces a level. A Text
 * stays on one line with its Spans: text reads back as written only on the line of its tags.
 */
@injectable()
export class XmlWriter {
  readonly #escape;

  constructor(xmlEscape = inject(XML_ESCAPE)) {
    this.#escape = xmlEscape;
  }

  xml(root: XmlElement | null): string {
    return root === null ? "" : this.#lines(root, 0).join(XML.lineBreak);
  }

  #lines(element: XmlElement, level: number): string[] {
    const indent = XML.indent.repeat(level);
    const attributes = this.#attributes(element.attributes);

    if (element.content !== null) {
      return [XML.text(indent, element.tag, attributes, this.#content(element.content))];
    }

    if (element.children.length === 0) {
      return [XML.leaf(indent, element.tag, attributes)];
    }

    return [
      XML.open(indent, element.tag, attributes),
      ...element.children.flatMap((child) => this.#lines(child, level + 1)),
      XML.close(indent, element.tag),
    ];
  }

  #attributes(attributes: readonly XmlAttribute[]): string {
    return attributes.map(([name, value]) => XML.attribute(name, this.#escape.attribute(value))).join("");
  }

  #content(content: readonly XmlContent[]): string {
    return content
      .map((piece) =>
        piece.kind === XML_CONTENT.text
          ? this.#escape.text(piece.value)
          : XML.text("", XML.spanTag, this.#attributes(piece.attributes), this.#escape.text(piece.value)),
      )
      .join("");
  }
}

export const XML_WRITER = new InjectionToken<XmlWriter>("XmlWriter");
