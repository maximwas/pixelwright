import { SPAN_ATTRIBUTES } from "../../css-mapping/vocabulary.ts";
import type { XmlChild, XmlElementNode } from "../../types/xml.ts";
import type { ApplyError, ContentPiece } from "../types.ts";

/**
 * A Text's content as pieces: its characters, and its Spans' with the run attributes they set (a nested span's
 * characters belong to the span that holds it). An element other than a Span, and an attribute a Span cannot set,
 * are errors, left out.
 */
export function piecesOf(node: XmlElementNode, errors: ApplyError[]): ContentPiece[] {
  return node.children.flatMap((child): ContentPiece[] => {
    if (child.kind === "text") {
      return [
        {
          line: child.line,
          column: child.column,
          kind: "text",
          value: child.value,
        },
      ];
    }

    if (child.type !== "Span") {
      errors.push({
        line: child.line,
        column: child.column,
        message: `<${child.type}> inside a ${node.type}: a text holds only text and <Span> runs.`,
        // A text on a path is no frame around a text: its characters are its own.
        ...(child.type === "Text" && node.type === "TextPath"
          ? { hint: 'Write the characters in the TextPath itself: <TextPath id="…">text</TextPath>.' }
          : {}),
      });

      return [];
    }

    return [spanOf(child, errors)];
  });
}

function spanOf(span: XmlElementNode, errors: ApplyError[]): ContentPiece {
  nestedProblems(span.children, errors);

  for (const name of Object.keys(span.props)) {
    if (!SPAN_ATTRIBUTES.has(name)) {
      errors.push({
        line: span.line,
        column: span.column,
        attribute: name,
        message: `${name} is not an attribute of <Span>: left out.`,
      });
    }
  }

  return {
    line: span.line,
    column: span.column,
    kind: "span",
    attributes: Object.fromEntries(Object.entries(span.props).filter(([name]) => SPAN_ATTRIBUTES.has(name))),
    value: charactersOf(span.children),
  };
}

/** The characters of a span's content, a nested span's included. */
function charactersOf(children: readonly XmlChild[]): string {
  return children.map((child) => (child.kind === "text" ? child.value : charactersOf(child.children))).join("");
}

/** What a span's content holds besides characters: a nested span's attributes and other elements are left out. */
function nestedProblems(children: readonly XmlChild[], errors: ApplyError[]): void {
  for (const child of children) {
    if (child.kind === "text") {
      continue;
    }

    if (child.type !== "Span") {
      errors.push({
        line: child.line,
        column: child.column,
        message: `<${child.type}> inside a <Span>: a run holds only characters, so it is left out.`,
      });
      continue;
    }

    for (const name of Object.keys(child.props)) {
      errors.push({
        line: child.line,
        column: child.column,
        attribute: name,
        message: `${name} is set on a <Span> inside a <Span>: runs do not nest, so it is left out.`,
      });
    }

    nestedProblems(child.children, errors);
  }
}
