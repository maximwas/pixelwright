import { type NumberedStyle, type SnapshotStyle, styleNumbers } from "@pixelwright/core";
import { plain } from "../utils/plain.ts";
import { loaded, usedUnder } from "./used-tokens.ts";

/** A style as snapshots and tokens carry it: its name, and its value for the tokens. */
export function styleOf(style: BaseStyle): SnapshotStyle {
  const base = {
    name: style.name,
    type: style.type,
    remote: style.remote,
  };

  if (style.type === "PAINT") {
    return {
      ...base,
      paints: plain<SnapshotStyle["paints"]>((style as PaintStyle).paints),
    };
  }

  if (style.type === "EFFECT") {
    return {
      ...base,
      effects: plain<SnapshotStyle["effects"]>((style as EffectStyle).effects),
    };
  }

  if (style.type === "TEXT") {
    const text = style as TextStyle;

    return {
      ...base,
      fontName: { ...text.fontName },
      fontSize: text.fontSize,
      lineHeight: plain<SnapshotStyle["lineHeight"]>(text.lineHeight),
      letterSpacing: plain<SnapshotStyle["letterSpacing"]>(text.letterSpacing),
      textCase: text.textCase,
      textDecoration: text.textDecoration,
    };
  }

  return base;
}

/** The file's own paint, text and effect styles (grid styles do not reach code), numbered where names repeat. */
export async function localStyles(): Promise<(SnapshotStyle & { id: string })[]> {
  return numbered(
    (await ownStyles()).map((style) => ({
      id: style.id,
      ...styleOf(style),
    })),
  );
}

/** The file's own paint, text and effect styles as Figma has them. */
export async function ownStyles(): Promise<BaseStyle[]> {
  return [
    ...(await figma.getLocalPaintStylesAsync()),
    ...(await figma.getLocalTextStylesAsync()),
    ...(await figma.getLocalEffectStylesAsync()),
  ];
}

/**
 * What same-named styles are numbered among: the file's own and the ones these pages' layers use (a team library's).
 * Every reader takes the page of what it reads, so a snapshot of one layer, design_apply's entries, tokens_read and the
 * token index all call the same library style --Black-2. The file's own styles come first, so their numbers never
 * depend on a page: without pages only they are taken.
 */
export async function numberingStyles(pages: Iterable<PageNode>): Promise<NumberedStyle[]> {
  const styles: NumberedStyle[] = (await ownStyles()).map(({ id, type, name, remote }) => ({
    id,
    type,
    name,
    remote,
  }));
  const known = new Set(styles.map((style) => style.id));

  for (const page of pages) {
    await loaded(page);

    for (const id of usedUnder(page).styleIds) {
      // A library style Figma cannot reach (offline) is left out of the numbering, not an error.
      const style = known.has(id) ? null : await figma.getStyleByIdAsync(id).catch(() => null);

      if (style !== null) {
        styles.push({
          id,
          type: style.type,
          name: style.name,
          remote: style.remote,
        });
        known.add(id);
      }
    }
  }

  return styles;
}

/**
 * The styles with `duplicate` set on each that shares its kind and name with another, numbered among them and `also`
 * (core styleNumbers), so every reader names --Black-2 the same style.
 */
export function numbered<T extends NumberedStyle>(styles: readonly T[], also: readonly NumberedStyle[] = []): T[] {
  const numbers = styleNumbers([...also, ...styles]);

  return styles.map((style) => {
    const { duplicate: _old, ...rest } = style as T & { duplicate?: unknown };
    const number = numbers.get(style.id) ?? 1;

    return (
      number > 1
        ? {
            ...rest,
            duplicate: number,
          }
        : rest
    ) as T;
  });
}

/** A layer's style id fields, each with the setter Figma takes it through. */
const STYLE_SETTERS = {
  fillStyleId: "setFillStyleIdAsync",
  strokeStyleId: "setStrokeStyleIdAsync",
  effectStyleId: "setEffectStyleIdAsync",
  textStyleId: "setTextStyleIdAsync",
  gridStyleId: "setGridStyleIdAsync",
} as const;

export type StyleField = keyof typeof STYLE_SETTERS;

export const STYLE_FIELDS = Object.keys(STYLE_SETTERS) as StyleField[];

/** Sets one of a layer's style ids through Figma's setter for it; a layer without that field is left alone. */
export async function setStyleId(layer: BaseNode, field: StyleField, id: string): Promise<void> {
  const setter = (layer as BaseNode & Record<string, unknown>)[STYLE_SETTERS[field]];

  if (typeof setter === "function") {
    await setter.call(layer, id);
  }
}
