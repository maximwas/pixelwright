import type { SnapshotStyle } from "@pixelwright/core";
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

/** The file's own paint, text and effect styles (grid styles do not reach code). */
export async function localStyles(): Promise<(SnapshotStyle & { id: string })[]> {
  const styles: BaseStyle[] = [
    ...(await figma.getLocalPaintStylesAsync()),
    ...(await figma.getLocalTextStylesAsync()),
    ...(await figma.getLocalEffectStylesAsync()),
  ];

  return styles.map((style) => ({
    id: style.id,
    ...styleOf(style),
  }));
}
