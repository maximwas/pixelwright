import type { DesignSpan } from "../types/design.ts";
import { escapeAttribute } from "../xml/escape.ts";
import { inlineText } from "../xml/parse/entities.ts";
import type { DesignAttribute, DesignContent, DesignElement } from "./tree.ts";

const INDENT = "  ";

/** A tree written as XML: its lines, and where each element sits in them (fitting a read measures branches by them). */
export interface SerializedDesign {
  readonly xml: string;
  readonly lines: readonly string[];
  readonly spans: ReadonlyMap<string, DesignSpan>;
}

/**
 * The design tree as XML, an element per line or a pair of lines around its children, two spaces per level. A Text
 * stays on one line with its spans: text reads back as written only on the line of its tags.
 */
export function serializeDesign(root: DesignElement | null): SerializedDesign {
  const lines: string[] = [];
  const spans = new Map<string, DesignSpan>();

  if (root !== null) {
    writeElement(root, {
      lines,
      spans,
      level: 0,
      parent: null,
    });
  }

  return {
    xml: lines.join("\n"),
    lines,
    spans,
  };
}

/** Where an element is written: the lines so far, the spans, its depth and its parent's layer. */
interface Place {
  readonly lines: string[];
  readonly spans: Map<string, DesignSpan>;
  readonly level: number;
  readonly parent: string | null;
}

function writeElement(element: DesignElement, place: Place): void {
  const { lines, level } = place;
  const start = lines.length;
  const indent = INDENT.repeat(level);
  const open = `${indent}<${element.tag}${attributesXml(element.attributes)}`;

  if (element.content !== null) {
    lines.push(`${open}>${element.content.map(contentXml).join("")}</${element.tag}>`);
  } else if (element.children.length === 0) {
    lines.push(`${open}/>`);
  } else {
    lines.push(`${open}>`);

    for (const child of element.children) {
      writeElement(child, {
        ...place,
        level: level + 1,
        parent: element.id,
      });
    }

    lines.push(`${indent}</${element.tag}>`);
  }

  place.spans.set(element.id, {
    start,
    end: lines.length - 1,
    level,
    parent: place.parent,
  });
}

function attributesXml(attributes: readonly DesignAttribute[]): string {
  return attributes.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join("");
}

function contentXml(piece: DesignContent): string {
  return piece.kind === "text"
    ? inlineText(piece.value)
    : `<Span${attributesXml(piece.attributes)}>${inlineText(piece.value)}</Span>`;
}
