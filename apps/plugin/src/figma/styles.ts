import { type NumberedStyle, type SnapshotStyle, styleNumbers } from "@pixelwright/core";
import { plain } from "../utils/plain.ts";

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
