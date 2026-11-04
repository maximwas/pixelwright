import { InjectionToken, inject, injectable } from "@needle-di/core";
import { AUTO_LINE_HEIGHT, FONT_NUMBER, FONT_UNIT } from "@/core/css/fonts/fonts.constants.ts";
import { FIGMA_PAINT } from "@/core/css/paints/paints.constants.ts";
import type { ColorSpace } from "@/core/kernel/color/color.ts";
import { FONT_WEIGHT } from "@/core/kernel/names/font-weight.ts";
import {
  DTCG_KEY,
  DTCG_NOTE,
  DTCG_NUMBER,
  DTCG_SHADOW_COLOR,
  DTCG_SHADOWS,
  DTCG_TEXT,
  DTCG_TYPE,
} from "@/core/tokens/formats/dtcg/dtcg.constants.ts";
import type { DtcgGroup, DtcgToken } from "@/core/tokens/formats/dtcg/dtcg.types.ts";
import { DTCG_PATHS } from "@/core/tokens/formats/dtcg/dtcg-paths.ts";
import { DTCG_VALUES } from "@/core/tokens/formats/dtcg/dtcg-values.ts";
import { STYLE_GROUP, STYLE_GROUPS } from "@/core/tokens/model/model.constants.ts";
import type { RawStyle } from "@/shared/ops/variables/variables.schema.ts";

/** The text styles DTCG holds with a stand-in: Auto line height as 1.2, a weight guessed from the style's name. */
interface StandIns {
  readonly auto: string[];
  readonly guessed: string[];
}

/**
 * The styles' tree (K-017): a paint style as a colour or a gradient (each stop's alpha kept, faded by the paint's
 * opacity; DTCG keeps no angle), a text style as typography (the weight from a variable font's axis, else guessed from
 * the style's name, K-074), drop and inner shadows as a shadow token; what DTCG has no type for is named in the notes.
 */
@injectable()
export class DtcgStyles {
  readonly #paths;
  readonly #values;
  readonly #weight;

  constructor(
    paths = inject(DTCG_PATHS),
    values = inject(DTCG_VALUES),
    weight = inject(FONT_WEIGHT),
  ) {
    this.#paths = paths;
    this.#values = values;
    this.#weight = weight;
  }

  tree(styles: readonly RawStyle[], space: ColorSpace): { tree: DtcgGroup; notes: string[] } {
    const tree: DtcgGroup = {};
    const renamed: string[] = [];
    const untyped: string[] = [];
    const standIns: StandIns = { auto: [], guessed: [] };
    const placed = this.#paths.places(
      styles.map(({ id, name }) => ({ id, name, path: this.#paths.path(name) })),
      renamed,
    );

    for (const style of styles) {
      const token = this.#token(style, space, standIns);

      if (token === null) {
        untyped.push(DTCG_TEXT.kind(style.name, style.type));
      } else {
        this.#paths.put(tree, placed.get(style.id) ?? [], token);
      }
    }

    return {
      tree,
      notes: [
        ...renamed,
        ...(untyped.length === 0 ? [] : [DTCG_NOTE.untypedStyles(untyped)]),
        ...(standIns.auto.length === 0 ? [] : [DTCG_NOTE.autoLineHeight(standIns.auto, DTCG_NUMBER.autoLineHeight)]),
        ...(standIns.guessed.length === 0 ? [] : [DTCG_NOTE.weightGuess(standIns.guessed)]),
      ],
    };
  }

  #token(
    style: RawStyle,
    space: ColorSpace,
    standIns: StandIns,
  ): DtcgToken | null {
    switch (STYLE_GROUPS[style.type]) {
      case STYLE_GROUP.paint:
        return this.#paint(style, space);
      case STYLE_GROUP.text:
        return this.#typography(style, standIns);
      case STYLE_GROUP.effect:
        return this.#shadow(style, space);
      default:
        return null;
    }
  }

  /** One visible solid paint as a colour, one visible gradient as a gradient; DTCG has nothing for the rest. */
  #paint(style: RawStyle, space: ColorSpace): DtcgToken | null {
    const paints = (style.paints ?? []).filter((paint) => paint.visible ?? true);
    const [paint] = paints;

    if (paints.length !== 1 || paint === undefined) {
      return null;
    }

    const opacity = paint.opacity ?? DTCG_NUMBER.opaque;

    if (paint.type === FIGMA_PAINT.solid && paint.color !== undefined) {
      return { $type: DTCG_TYPE.color, $value: this.#values.color(paint.color, opacity, space) };
    }

    if (!paint.type.startsWith(DTCG_KEY.gradient) || paint.gradientStops === undefined) {
      return null;
    }

    // Each stop keeps its alpha and the paint's opacity fades them all (K-017: 0.7.0 dropped both).
    return {
      $type: DTCG_TYPE.gradient,
      $value: paint.gradientStops.map((stop) => ({
        color: this.#values.color(stop.color, opacity, space),
        position: this.#values.number(stop.position),
      })),
    };
  }

  /** A text style's family, size, weight, line height (a multiple of the size) and letter spacing. */
  #typography(style: RawStyle, standIns: StandIns): DtcgToken | null {
    const { fontName, fontSize: size, lineHeight, letterSpacing } = style;

    if (fontName === undefined || size === undefined) {
      return null;
    }

    const ratio = this.#ratio(lineHeight, size);
    const axis = fontName.variationSettings?.[DTCG_KEY.weightAxis];

    if (ratio === null) {
      standIns.auto.push(style.name);
    }

    if (axis === undefined) {
      standIns.guessed.push(style.name);
    }

    return {
      $type: DTCG_TYPE.typography,
      $value: {
        fontFamily: fontName.family,
        fontSize: this.#values.px(size),
        fontWeight: axis ?? this.#weight.guess(fontName.style),
        lineHeight: ratio ?? DTCG_NUMBER.autoLineHeight,
        letterSpacing: this.#values.px(this.#spacing(letterSpacing, size)),
      },
    };
  }

  /** A line height as a multiple of the font size; null for Auto, or none. */
  #ratio(lineHeight: RawStyle["lineHeight"], size: number): number | null {
    if (lineHeight?.value === undefined || lineHeight.unit === AUTO_LINE_HEIGHT.auto) {
      return null;
    }

    return this.#values.number(
      lineHeight.unit === FONT_UNIT.percent ? lineHeight.value / FONT_NUMBER.percent : lineHeight.value / size,
    );
  }

  /** Letter spacing in px: Figma's percent is of the font size. */
  #spacing(letterSpacing: RawStyle["letterSpacing"], size: number): number {
    if (letterSpacing === undefined) {
      return 0;
    }

    return letterSpacing.unit === FONT_UNIT.percent
      ? (letterSpacing.value * size) / FONT_NUMBER.percent
      : letterSpacing.value;
  }

  /** Drop and inner shadows as a shadow token, one or a list; a style with any other effect has no DTCG type. */
  #shadow(style: RawStyle, space: ColorSpace): DtcgToken | null {
    const effects = (style.effects ?? []).filter((effect) => effect.visible ?? true);

    if (effects.length === 0 || !effects.every((effect) => effect.type in DTCG_SHADOWS)) {
      return null;
    }

    const shadows = effects.map((effect) => ({
      color: this.#values.color(effect.color ?? DTCG_SHADOW_COLOR, DTCG_NUMBER.opaque, space),
      offsetX: this.#values.px(effect.offset?.x ?? 0),
      offsetY: this.#values.px(effect.offset?.y ?? 0),
      blur: this.#values.px(effect.radius ?? 0),
      spread: this.#values.px(effect.spread ?? 0),
      ...(DTCG_SHADOWS[effect.type] ? { inset: true } : {}),
    }));

    return { $type: DTCG_TYPE.shadow, $value: shadows.length === 1 ? shadows[0] : shadows };
  }
}

export const DTCG_STYLES = new InjectionToken<DtcgStyles>("DtcgStyles");
