import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FONT_SHORTHAND } from "@/core/css/fonts/font-shorthand.ts";
import { CASE_CSS } from "@/core/css/fonts/fonts.constants.ts";
import { BLURS } from "@/core/css/groups/effects/effects.constants.ts";
import { EFFECTS_GROUP } from "@/core/css/groups/effects/effects-group.ts";
import { DECORATION_LINES } from "@/core/css/groups/text/text.constants.ts";
import { type Channels, Color, type ColorSpace } from "@/core/kernel/color/color.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { BIND_FIELD, BIND_TEXT, SHADOW_TYPES } from "@/core/tokens/bind/bind.constants.ts";
import type { TextParts } from "@/core/tokens/bind/bind.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ModelTables } from "@/shared/read-model/read-model.schema.ts";

type Effect = NonNullable<ReadLayer["effects"]>[number];

/**
 * Raw values as design_read writes them (K-028), through design_read's own formatters: two values match exactly when
 * the reads would print the same, so tokens_bind and design_lint tell values apart alike.
 */
@injectable()
export class BindValues {
  readonly #fonts;
  readonly #effects;
  readonly #format;

  constructor(
    fonts = inject(FONT_SHORTHAND),
    effects = inject(EFFECTS_GROUP),
    format = inject(NUMBER_FORMAT),
  ) {
    this.#fonts = fonts;
    this.#effects = effects;
    this.#format = format;
  }

  /** A colour in the file's space faded by an opacity: `#3B2FD9`, `rgba(…)` when see-through. */
  color(
    color: Channels,
    opacity: number,
    space: ColorSpace,
  ): string {
    return Color.of(color, space).faded(opacity).css();
  }

  /** A number field's value: an opacity bare, a border width with its fractions, spacing and radii in whole px. */
  number(css: string, value: number): string {
    if (css === CSS_PROPERTY.opacity) {
      return String(this.round(value));
    }

    return BIND_TEXT.px(
      this.#format.round(value, css === BIND_FIELD.borderWidth ? PRECISION.stroke : PRECISION.spacing),
    );
  }

  /** A number as the index compares it: two decimals, so float noise never splits two equal values. */
  round(value: number): number {
    return this.#format.round(value, PRECISION.decimal);
  }

  /** A text's style parts: the font shorthand, then its letter spacing, case and decoration. */
  text(parts: TextParts): string {
    const spacing = this.#fonts.letterSpacing(parts.letterSpacing);
    const transform = CASE_CSS[parts.textCase];
    const decoration = DECORATION_LINES[parts.textDecoration];

    return [
      this.#fonts.font(parts),
      spacing === null ? null : BIND_TEXT.declaration(CSS_PROPERTY.letterSpacing, spacing),
      transform === undefined ? null : BIND_TEXT.declaration(CSS_PROPERTY.textTransform, transform),
      decoration === undefined ? null : BIND_TEXT.declaration(CSS_PROPERTY.textDecoration, decoration),
    ]
      .filter((part) => part !== null)
      .join(BIND_TEXT.joint);
  }

  /**
   * The visible shadows and blurs (`box-shadow: …; filter: blur(…)`); null when there are none, or one is an effect CSS
   * has no word for (noise, texture, glass), which no effect style is matched to.
   */
  effects(effects: readonly Effect[], tables: ModelTables): string | null {
    const visible = effects.filter((effect) => effect.visible ?? true);

    if (
      visible.length === 0 ||
      visible.some((effect) => !SHADOW_TYPES.includes(effect.type) && BLURS[effect.type] === undefined)
    ) {
      return null;
    }

    const shadows = this.#effects.shadows(visible, false, tables);
    const blurs = this.#effects.blurs(visible).map(([property, value]) => BIND_TEXT.declaration(property, value));

    return [...(shadows === "" ? [] : [BIND_TEXT.declaration(CSS_PROPERTY.boxShadow, shadows)]), ...blurs].join(
      BIND_TEXT.joint,
    );
  }
}

export const BIND_VALUES = new InjectionToken<BindValues>("BindValues");
