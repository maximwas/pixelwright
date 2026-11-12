import { roundTo } from "../../kernel/numbers.ts";
import type { SnapshotNode, TextSegment } from "../../types/snapshot.ts";

/** The px Figma renders an Auto line height at, by font and size (fontKey), where a read can tell it. */
export type AutoLineHeights = ReadonlyMap<string, number>;

/** Where a text's lines end: Enter (a line feed, or U+2029) and Shift+Enter (U+2028). */
const LINE_BREAK = new RegExp(`[\n${String.fromCodePoint(0x2028, 0x2029)}]`);

/** What an Auto line height depends on: the font's family and style, and its size. */
export function fontKey({ fontName, fontSize }: Pick<TextSegment, "fontName" | "fontSize">): string {
  return JSON.stringify([fontName.family, fontName.style, fontSize]);
}

/**
 * The Auto line heights a read's texts show. Figma sizes a text that hugs its lines (auto width and height) by them: in
 * one font and size, with nothing between its lines (no leading trim, paragraph or list spacing), it is as tall as its
 * lines, and every text in that font and size has lines that tall. The first such text of a font and size gives it.
 */
export function autoLineHeights(root: SnapshotNode): Map<string, number> {
  const found = new Map<string, number>();

  for (const node of layersOf(root)) {
    const [first] = node.text?.segments ?? [];

    if (first !== undefined && hugsItsLines(node) && !found.has(fontKey(first))) {
      found.set(fontKey(first), roundTo(node.height / (node.text?.characters ?? "").split(LINE_BREAK).length, 2));
    }
  }

  return found;
}

/** A text whose height is its lines' alone: it hugs them, so never wraps, in one font and size, Auto, nothing between. */
function hugsItsLines({ type, text }: SnapshotNode): boolean {
  const [first] = text?.segments ?? [];

  return (
    type === "TEXT" &&
    first !== undefined &&
    text?.textAutoResize === "WIDTH_AND_HEIGHT" &&
    text.leadingTrim === undefined &&
    text.paragraphSpacing === undefined &&
    text.listSpacing === undefined &&
    text.segments.every((segment) => segment.lineHeight.unit === "AUTO" && fontKey(segment) === fontKey(first))
  );
}

function layersOf(node: SnapshotNode): SnapshotNode[] {
  return [node, ...(node.children ?? []).flatMap(layersOf)];
}
