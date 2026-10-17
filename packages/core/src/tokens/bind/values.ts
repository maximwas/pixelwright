import { shadowListCss } from "../../css-mapping/groups/effects.ts";
import { CASE_CSS } from "../../css-mapping/groups/text/styles.ts";
import { fontShorthand, letterSpacingCss } from "../../css-mapping/values/fonts.ts";
import { px } from "../../css-mapping/values/format.ts";
import { type Channels, Color } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { decimal } from "../../kernel/numbers.ts";
import type { SnapshotEffect, TextSegment } from "../../types/snapshot.ts";

/** The parts of a text a text style sets: what two texts share when one style fits both. */
export type TextParts = Pick<
  TextSegment,
  "fontName" | "fontSize" | "lineHeight" | "letterSpacing" | "textCase" | "textDecoration"
>;

const DECORATIONS: Readonly<Record<string, string>> = {
  UNDERLINE: "underline",
  STRIKETHROUGH: "line-through",
};

/** The blurs an effect style may hold, as the CSS property each is. */
const BLURS: Readonly<Record<string, string>> = {
  LAYER_BLUR: "filter",
  BACKGROUND_BLUR: "backdrop-filter",
};

const SHADOWS: ReadonlySet<string> = new Set(["DROP_SHADOW", "INNER_SHADOW"]);

/**
 * A colour as design_read writes it (`#3B2FD9`, `rgba(…)` when see-through): how tokens_bind and design_lint tell two
 * colours apart, so a value matches a token exactly when the reads would print the same.
 */
export function colorValue(color: Channels, opacity: number, space: ColorSpace): string {
  return Color.of(color, space).faded(opacity).css();
}

/** A number field's value as CSS writes it: px, an opacity as a plain number. */
export function numberValue(field: string, value: number): string {
  return field === "opacity" ? decimal(value) : px(value);
}

/** A text's style parts as design_read writes them: the font shorthand, then spacing, case and decoration. */
export function textValue(parts: TextParts): string {
  const spacing = letterSpacingCss(parts.letterSpacing);
  const transform = CASE_CSS[parts.textCase];
  const decoration = DECORATIONS[parts.textDecoration];

  return [
    fontShorthand(parts),
    spacing === null ? null : `letter-spacing: ${spacing}`,
    transform === undefined ? null : `text-transform: ${transform}`,
    decoration === undefined ? null : `text-decoration: ${decoration}`,
  ]
    .filter((part) => part !== null)
    .join("; ");
}

/**
 * A layer's visible shadows and blurs as CSS (`box-shadow: …; filter: blur(…)`); null when it has none, or holds an
 * effect CSS has no word for (noise, texture, glass), which no effect style is matched to.
 */
export function effectsValue(effects: readonly SnapshotEffect[], space: ColorSpace = "srgb"): string | null {
  const visible = effects.filter((effect) => effect.visible ?? true);

  if (visible.length === 0 || visible.some((effect) => !SHADOWS.has(effect.type) && BLURS[effect.type] === undefined)) {
    return null;
  }

  const shadows = shadowListCss(visible, space);
  const blurs = visible.flatMap((effect) => {
    const property = BLURS[effect.type];

    return property === undefined ? [] : [`${property}: blur(${px((effect.radius ?? 0) / 2)})`];
  });

  return [shadows === "" ? null : `box-shadow: ${shadows}`, ...blurs].filter((part) => part !== null).join("; ");
}
