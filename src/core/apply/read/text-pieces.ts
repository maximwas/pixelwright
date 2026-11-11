import { APPLY_TAG, SPAN_ATTRIBUTES } from "@/core/apply/apply.constants.ts";
import type { ApplyError, ContentPiece, ElementNode } from "@/core/apply/apply.types.ts";
import { PIECE_TEXT } from "@/core/apply/read/read.constants.ts";
import { XML_NODE_KIND } from "@/core/xml/parse/parse.constants.ts";
import type { XmlNode } from "@/core/xml/parse/parse.types.ts";
import { TAG } from "@/core/xml/tags.constants.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";

/**
 * C-164: a Text's content as pieces: its characters, and its Spans' with the run attributes they set (a nested span's
 * characters belong to the span that holds it). An element other than a Span, and an attribute a Span cannot set,
 * are errors, pushed on `errors` and left out.
 */
export class TextPieces {
  of(node: ElementNode, errors: ApplyError[]): ContentPiece[] {
    return node.children.flatMap((child): ContentPiece[] => {
      if (child.kind === XML_NODE_KIND.text) {
        return [{ line: child.line, column: child.column, kind: XML_CONTENT.text, value: child.value }];
      }

      if (child.type !== APPLY_TAG.span) {
        errors.push({
          line: child.line,
          column: child.column,
          message: PIECE_TEXT.notSpan(child.type, node.type),
          // A text on a path is no frame around a text: its characters are its own.
          ...(child.type === TAG.TEXT && node.type === TAG.TEXT_PATH ? { hint: PIECE_TEXT.textPathHint } : {}),
        });

        return [];
      }

      return [this.#span(child, errors)];
    });
  }

  #span(span: ElementNode, errors: ApplyError[]): ContentPiece {
    this.#nested(span.children, errors);

    for (const name of Object.keys(span.props)) {
      if (!SPAN_ATTRIBUTES.has(name)) {
        errors.push({ line: span.line, column: span.column, attribute: name, message: PIECE_TEXT.runAttribute(name) });
      }
    }

    return {
      line: span.line,
      column: span.column,
      kind: XML_CONTENT.span,
      attributes: Object.fromEntries(Object.entries(span.props).filter(([name]) => SPAN_ATTRIBUTES.has(name))),
      value: this.#characters(span.children),
    };
  }

  /** The characters of a span's content, a nested span's included. */
  #characters(children: readonly XmlNode[]): string {
    return children
      .map((child) => (child.kind === XML_NODE_KIND.text ? child.value : this.#characters(child.children)))
      .join("");
  }

  /** What a span's content holds besides characters: a nested span's attributes and other elements are left out. */
  #nested(children: readonly XmlNode[], errors: ApplyError[]): void {
    for (const child of children) {
      if (child.kind === XML_NODE_KIND.text) {
        continue;
      }

      if (child.type !== APPLY_TAG.span) {
        errors.push({ line: child.line, column: child.column, message: PIECE_TEXT.runHolds(child.type) });
        continue;
      }

      for (const name of Object.keys(child.props)) {
        errors.push({ line: child.line, column: child.column, attribute: name, message: PIECE_TEXT.runNests(name) });
      }

      this.#nested(child.children, errors);
    }
  }
}
