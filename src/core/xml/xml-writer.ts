import { InjectionToken, inject, injectable } from "@needle-di/core";
import { XML, XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { WrittenXml, XmlAttribute, XmlContent, XmlElement, XmlSpan } from "@/core/xml/xml.types.ts";
import { XML_ESCAPE } from "@/core/xml/xml-escape.ts";

/**
 * A tree as light XML (C-1.1): an element per line, or a pair of lines around its children, two spaces a level. A Text
 * stays on one line with its Spans: text reads back as written only on the line of its tags.
 */
/** Where an element is written: the lines so far, the spans, its depth and its parent's id. */
interface XmlPlace {
  readonly lines: string[];
  readonly spans: Map<string, XmlSpan>;
  readonly level: number;
  readonly parent: string | null;
}

@injectable()
export class XmlWriter {
  readonly #escape;

  constructor(xmlEscape = inject(XML_ESCAPE)) {
    this.#escape = xmlEscape;
  }

  xml(root: XmlElement | null): string {
    return this.written(root).xml;
  }

  /** The XML with its lines and each element's span. */
  written(root: XmlElement | null): WrittenXml {
    const lines: string[] = [];
    const spans = new Map<string, XmlSpan>();

    if (root !== null) {
      this.#write(root, { lines, spans, level: 0, parent: null });
    }

    return { xml: lines.join(XML.lineBreak), lines, spans };
  }

  #write(element: XmlElement, place: XmlPlace): void {
    const { lines, level } = place;
    const start = lines.length;
    const indent = XML.indent.repeat(level);
    const attributes = this.#attributes(element.attributes);

    if (element.content !== null) {
      lines.push(XML.text(indent, element.tag, attributes, this.#content(element.content)));
    } else if (element.children.length === 0) {
      lines.push(XML.leaf(indent, element.tag, attributes));
    } else {
      lines.push(XML.open(indent, element.tag, attributes));

      for (const child of element.children) {
        this.#write(child, { ...place, level: level + 1, parent: element.id });
      }

      lines.push(XML.close(indent, element.tag));
    }

    place.spans.set(element.id, { start, end: lines.length - 1, level, parent: place.parent });
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
