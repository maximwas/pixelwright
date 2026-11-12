import { baseSegment } from "../../css-mapping/groups/text/run.ts";
import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import type { A11yHeading } from "./schemas.ts";

/** How much larger than the body a text reads as a heading. */
const LARGER = 1.15;

/** The longest text a heading is: a line or two, not a paragraph. */
const HEADING_CHARS = 120;

/** A letter of any script: a text with none (a price, a number) is no heading, however large. */
const LETTER = /\p{L}/u;

/** A heading level a text style's name gives: H2, Heading 3, Title/H1. */
const STYLE_LEVEL = /\bh([1-6])\b|heading\s*([1-6])/i;

/** A text as headings are found among: its layer, its run that covers most of it, its text style's name. */
interface ScreenText {
  readonly node: SnapshotNode;
  readonly size: number;
  readonly style: string | undefined;
}

/** A screen's texts outside its controls, as headings are found among. */
export function screenTexts(texts: readonly SnapshotNode[], snapshot: Snapshot): ScreenText[] {
  return texts.flatMap((node) => {
    const base = baseSegment(node.text?.segments ?? []);

    return base === undefined
      ? []
      : [
          {
            node,
            size: base.fontSize,
            style: base.textStyleId === "" ? undefined : snapshot.styles[base.textStyleId]?.name,
          },
        ];
  });
}

/** The size most of the screen's characters are set in: its body text. */
function bodySize(texts: readonly ScreenText[]): number {
  const characters = new Map<number, number>();

  for (const { node, size } of texts) {
    characters.set(size, (characters.get(size) ?? 0) + (node.text?.characters.length ?? 0));
  }

  return [...characters].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 16;
}

/**
 * The texts that read as headings: a text style named for a level (H2, Heading 3) at that level; a short text larger
 * than the body at a level by its size, the largest h1. In the order they read.
 */
export function headingsOf(texts: readonly ScreenText[]): A11yHeading[] {
  const body = bodySize(texts);
  const sized = texts.filter(
    ({ node, size, style }) =>
      !STYLE_LEVEL.test(style ?? "") &&
      size > body * LARGER &&
      (node.text?.characters.length ?? 0) <= HEADING_CHARS &&
      LETTER.test(node.text?.characters ?? ""),
  );
  const sizes = [...new Set(sized.map(({ size }) => size))].sort((a, b) => b - a);

  return texts.flatMap(({ node, size, style }) => {
    const match = STYLE_LEVEL.exec(style ?? "");
    const level = match === null ? sizes.indexOf(size) + 1 : Number(match[1] ?? match[2]);

    return level === 0 || (match === null && !sized.some((each) => each.node === node))
      ? []
      : [
          {
            id: node.id,
            text: (node.text?.characters ?? "").slice(0, 80),
            level: Math.min(level, 6),
            size,
            from: match === null ? ("size" as const) : ("style" as const),
          },
        ];
  });
}

/** What the headings' levels get wrong: no h1, more than one, a level skipped. */
export function headingNotes(headings: readonly A11yHeading[]): string[] {
  const levels = [...new Set(headings.map(({ level }) => level))].sort((a, b) => a - b);
  const ones = headings.filter(({ level }) => level === 1).length;
  const notes: string[] = [];

  if (levels.length > 0 && levels[0] !== 1) {
    notes.push(`No text reads as h1: the screen's main heading should be one.`);
  }

  if (ones > 1) {
    notes.push(`${ones} texts read as h1: a page has one; make the others h2.`);
  }

  for (const [index, level] of levels.slice(1).entries()) {
    const before = levels[index] ?? level;

    if (level - before > 1) {
      notes.push(
        `Heading levels skip from h${before} to h${level}: use h${before + 1}, or style the text as a heading of its place.`,
      );
    }
  }

  return notes;
}
