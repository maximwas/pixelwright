import { isChannels } from "../../../kernel/color/color.ts";
import type { ColorSpace } from "../../../kernel/color/color-space.ts";
import { weightOf } from "../../../utils/font-weight.ts";
import type { RawStyle } from "../../raw-tokens.ts";
import { DTCG_AUTO_LINE_HEIGHT, DTCG_SHADOWS } from "./constants.ts";
import { pathOf, placements } from "./dtcg-paths.ts";
import { DtcgTreeBuilder } from "./dtcg-tree.ts";
import { dtcgColor, dtcgNumber, dtcgPx } from "./dtcg-values.ts";
import type { DtcgGroup, DtcgToken } from "./types.ts";

/** What writing a style needs: the file's colour space, and where text styles with Auto line height are listed. */
interface StyleContext {
  readonly space: ColorSpace;
  readonly autoLineHeight: string[];
}

/** Writes one kind of style as a DTCG token; null when DTCG has no type for it. */
type StyleWriter = (style: RawStyle, context: StyleContext) => DtcgToken | null;

const STYLE_WRITERS: ReadonlyMap<string, StyleWriter> = new Map([
  ["PAINT", paintToken],
  ["TEXT", typographyToken],
  ["EFFECT", shadowToken],
]);

/** The shadow colour Figma gives a shadow without one. */
const DEFAULT_SHADOW = {
  r: 0,
  g: 0,
  b: 0,
  a: 0.25,
};

/** The styles' tree: a colour, gradient, typography or shadow token per style, at its name's path. */
export function stylesTree(styles: readonly RawStyle[], space: ColorSpace): { tree: DtcgGroup; notes: string[] } {
  const builder = new DtcgTreeBuilder();
  const untyped: string[] = [];
  const renamed: string[] = [];
  const context: StyleContext = {
    space,
    autoLineHeight: [],
  };
  const placed = placements(
    styles.map(({ id, name }) => ({
      id,
      name,
      path: pathOf(name),
    })),
    renamed,
  );

  for (const style of styles) {
    const token = STYLE_WRITERS.get(style.type)?.(style, context) ?? null;

    if (token === null) {
      untyped.push(`${style.name} (${style.type.toLowerCase()})`);
    } else {
      builder.put(placed.get(style.id) ?? [], token);
    }
  }

  return {
    tree: builder.build(),
    notes: [...renamed, ...untypedNotes(untyped), ...autoLineHeightNotes(context.autoLineHeight)],
  };
}

/** One visible solid paint as a colour, one visible gradient as a gradient; DTCG has nothing for the rest. */
function paintToken(style: RawStyle, { space }: StyleContext): DtcgToken | null {
  const paints = (style.paints ?? []).filter((paint) => paint.visible ?? true);
  const [paint] = paints;

  if (paints.length !== 1 || paint === undefined) {
    return null;
  }

  if (paint.type === "SOLID" && isChannels(paint.color)) {
    return {
      $type: "color",
      $value: dtcgColor(paint.color, paint.opacity ?? 1, space),
    };
  }

  if (!paint.type.startsWith("GRADIENT_") || paint.gradientStops === undefined) {
    return null;
  }

  return {
    $type: "gradient",
    $value: paint.gradientStops.map((stop) => ({
      color: dtcgColor(stop.color, 1, space),
      position: dtcgNumber(stop.position),
    })),
  };
}

/** A text style's font, size, weight, line height (a multiple of the size) and letter spacing. */
function typographyToken(style: RawStyle, { autoLineHeight }: StyleContext): DtcgToken | null {
  const { fontName, fontSize: size, lineHeight, letterSpacing } = style;

  if (fontName === undefined || size === undefined) {
    return null;
  }

  const ratio = lineHeightRatio(lineHeight, size);

  if (ratio === null) {
    autoLineHeight.push(style.name);
  }

  return {
    $type: "typography",
    $value: {
      fontFamily: fontName.family,
      fontSize: dtcgPx(size),
      fontWeight: weightOf(fontName.style),
      lineHeight: ratio ?? DTCG_AUTO_LINE_HEIGHT,
      letterSpacing: dtcgPx(
        letterSpacing === undefined
          ? 0
          : letterSpacing.unit === "PERCENT"
            ? (letterSpacing.value * size) / 100
            : letterSpacing.value,
      ),
    },
  };
}

/** A line height as a multiple of the font size; null for Auto, or none. */
function lineHeightRatio(lineHeight: RawStyle["lineHeight"], size: number): number | null {
  if (lineHeight?.value === undefined || lineHeight.unit === "AUTO") {
    return null;
  }

  return dtcgNumber(lineHeight.unit === "PERCENT" ? lineHeight.value / 100 : lineHeight.value / size);
}

/** Drop and inner shadows as a shadow token (one, or a list); a style with anything else has no DTCG type. */
function shadowToken(style: RawStyle, { space }: StyleContext): DtcgToken | null {
  const effects = (style.effects ?? []).filter((effect) => effect.visible ?? true);

  if (effects.length === 0 || !effects.every((effect) => effect.type in DTCG_SHADOWS)) {
    return null;
  }

  const shadows = effects.map((effect) => ({
    color: dtcgColor(isChannels(effect.color) ? effect.color : DEFAULT_SHADOW, 1, space),
    offsetX: dtcgPx(effect.offset?.x ?? 0),
    offsetY: dtcgPx(effect.offset?.y ?? 0),
    blur: dtcgPx(effect.radius ?? 0),
    spread: dtcgPx(effect.spread ?? 0),
    ...(DTCG_SHADOWS[effect.type] ? { inset: true } : {}),
  }));

  return {
    $type: "shadow",
    $value: shadows.length === 1 ? shadows[0] : shadows,
  };
}

function untypedNotes(untyped: readonly string[]): string[] {
  return untyped.length === 0
    ? []
    : [`${untyped.join(", ")}: no DTCG type for ${untyped.length === 1 ? "this style" : "these styles"}, left out.`];
}

function autoLineHeightNotes(names: readonly string[]): string[] {
  return names.length === 0
    ? []
    : [
        `${names.join(", ")}: Auto line height, written as ${DTCG_AUTO_LINE_HEIGHT} (CSS's normal); give the style a line height in Figma to match exactly.`,
      ];
}
