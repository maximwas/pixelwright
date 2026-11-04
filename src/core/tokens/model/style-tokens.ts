import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FONT_SHORTHAND } from "@/core/css/fonts/font-shorthand.ts";
import { CASE_CSS } from "@/core/css/fonts/fonts.constants.ts";
import { EFFECTS_GROUP } from "@/core/css/groups/effects/effects-group.ts";
import { PAINT_LIST } from "@/core/css/paints/paint-list.ts";
import { FIGMA_PAINT } from "@/core/css/paints/paints.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import {
  MODEL_NOTE,
  MODEL_TEXT,
  MODEL_VALUE,
  NOTED_GROUPS,
  STYLE_BOX,
  STYLE_GROUP,
  STYLE_GROUPS,
  type StyleGroup,
} from "@/core/tokens/model/model.constants.ts";
import type { StyleToken, StyleTokenGroups } from "@/core/tokens/model/model.schema.ts";
import type { RawStyle } from "@/shared/ops/variables/variables.schema.ts";
import type { ModelTables } from "@/shared/read-model/read-model.schema.ts";

/**
 * The paint, text and effect styles as tokens (K-006), named as design_read names them (--Black-2 for the second
 * Black), valued through design_read's own mapping: a paint style's paints as PaintList writes a background, its
 * gradients from the paints on a square (C-022, D-20, no getCSSAsync); a text style as `--Name-font` (the font
 * shorthand) with its letter spacing and case as tokens of their own; an effect style's shadows as a box-shadow list
 * and its blurs as `--Name-filter` and `--Name-backdrop-filter` tokens (D-26). Same-named styles are noted.
 */
@injectable()
export class StyleTokens {
  readonly #paints;
  readonly #effects;
  readonly #fonts;
  readonly #names;

  constructor(
    paints = inject(PAINT_LIST),
    effects = inject(EFFECTS_GROUP),
    fonts = inject(FONT_SHORTHAND),
    names = inject(TOKEN_NAMES),
  ) {
    this.#paints = paints;
    this.#effects = effects;
    this.#fonts = fonts;
    this.#names = names;
  }

  tokens(
    styles: readonly RawStyle[],
    tables: ModelTables,
    notes: Set<string>,
  ): StyleTokenGroups {
    const groups: StyleTokenGroups = { paint: [], text: [], effect: [] };

    for (const style of styles) {
      const group = STYLE_GROUPS[style.type];
      const token = group === undefined ? null : this.#token(style, group, tables, notes);

      if (group !== undefined && token !== null) {
        groups[group].push(token);
      }
    }

    for (const [label, group] of NOTED_GROUPS) {
      this.#noteSameNames(label, groups[group], notes);
    }

    return groups;
  }

  #token(
    style: RawStyle,
    group: StyleGroup,
    tables: ModelTables,
    notes: Set<string>,
  ): StyleToken | null {
    const token = this.#names.style(style);

    if (group === STYLE_GROUP.paint) {
      return this.#paint(style, token, tables, notes);
    }

    return group === STYLE_GROUP.effect ? this.#effect(style, token, tables, notes) : this.#text(style, token);
  }

  /** The visible paints as one background value; an image, or what CSS cannot draw, is a note. */
  #paint(
    style: RawStyle,
    token: string,
    tables: ModelTables,
    notes: Set<string>,
  ): StyleToken | null {
    const visible = (style.paints ?? []).filter((paint) => paint.visible ?? true);
    const css = visible.some((paint) => paint.type === FIGMA_PAINT.image)
      ? null
      : this.#paints.css(visible, undefined, tables, STYLE_BOX);

    if (typeof css === "string") {
      return { name: style.name, token, value: css };
    }

    notes.add(MODEL_NOTE.paint(style.name, MODEL_TEXT.kinds(visible.map((paint) => paint.type))));

    return null;
  }

  /** The font shorthand as --<name>-font, its letter spacing and case as tokens of their own when not the default. */
  #text(style: RawStyle, token: string): StyleToken | null {
    const { fontName, fontSize, lineHeight } = style;

    if (fontName === undefined || fontSize === undefined || lineHeight === undefined) {
      return null;
    }

    const spacing = style.letterSpacing === undefined ? null : this.#fonts.letterSpacing(style.letterSpacing);
    const transform = CASE_CSS[style.textCase ?? ""];
    const also = [
      ...(spacing === null ? [] : [{ token: MODEL_TEXT.part(token, CSS_PROPERTY.letterSpacing), value: spacing }]),
      ...(transform === undefined
        ? []
        : [{ token: MODEL_TEXT.part(token, CSS_PROPERTY.textTransform), value: transform }]),
    ];

    return {
      name: style.name,
      token: MODEL_TEXT.part(token, MODEL_VALUE.font),
      value: this.#fonts.font({ fontName, fontSize, lineHeight }),
      ...(also.length === 0 ? {} : { also }),
    };
  }

  /** The shadows as the style's token, its blurs as --<name>-filter and --<name>-backdrop-filter after it. */
  #effect(
    style: RawStyle,
    token: string,
    tables: ModelTables,
    notes: Set<string>,
  ): StyleToken | null {
    const effects = style.effects ?? [];
    const shadows = this.#effects.shadows(effects, false, tables);
    const [main, ...also] = [
      ...(shadows === "" ? [] : [{ token, value: shadows }]),
      ...this.#effects.blurs(effects).map(([property, value]) => ({ token: MODEL_TEXT.part(token, property), value })),
    ];

    if (main === undefined) {
      notes.add(MODEL_NOTE.effect(style.name));

      return null;
    }

    return { name: style.name, token: main.token, value: main.value, ...(also.length === 0 ? {} : { also }) };
  }

  #noteSameNames(
    label: string,
    tokens: readonly StyleToken[],
    notes: Set<string>,
  ): void {
    const named = new Map<string, StyleToken[]>();

    for (const token of tokens) {
      named.set(token.name, [...(named.get(token.name) ?? []), token]);
    }

    for (const [name, group] of named) {
      if (group.length > 1) {
        const listed = MODEL_TEXT.list(group.map(({ token, value }) => MODEL_TEXT.pair(token, value)));

        notes.add(MODEL_NOTE.sameNames(label, name, group.length, listed));
      }
    }
  }
}

export const STYLE_TOKENS = new InjectionToken<StyleTokens>("StyleTokens");
