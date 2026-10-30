import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  LINT_CSS,
  LINT_FIGMA,
  LINT_FIX,
  LINT_FOUR_FIELDS,
  LINT_GRID,
  LINT_LIMITS,
  LINT_NEEDS,
  LINT_NUMBER_FIELDS,
  LINT_RULE,
  LINT_TEXT,
  OFF_SCALE_FIELDS,
} from "@/core/checks/lint/lint.constants.ts";
import type { LintRuleId } from "@/core/checks/lint/lint.schema.ts";
import type { LintLayer, RuleCheck, RuleFinding, RuleSet } from "@/core/checks/lint/lint.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FONT_SHORTHAND } from "@/core/css/fonts/font-shorthand.ts";
import { CASE_CSS } from "@/core/css/fonts/fonts.constants.ts";
import { EFFECTS_VALUE } from "@/core/css/groups/effects/effects.constants.ts";
import { EFFECTS_GROUP } from "@/core/css/groups/effects/effects-group.ts";
import { DECORATION_LINES } from "@/core/css/groups/text/text.constants.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Segment = NonNullable<ReadLayer["text"]>["segments"][number];

type Needs = (typeof LINT_NEEDS)[keyof typeof LINT_NEEDS];

type FourFields = (typeof LINT_FOUR_FIELDS)[number];

/** A raw number on a layer: its CSS word, its value as design_read writes it, and the variable Figma matches it to. */
interface RawNumber {
  readonly field: string;
  readonly value: string;
  readonly amount: number;
  readonly token: string | undefined;
}

/**
 * The rules on values no token gives a layer (K-036): texts without a text style, effects without an effect style,
 * numbers a variable holds used raw, spacing and radii off the grid. A token is known from Figma's own variable match
 * (the read's `inferred`), until tokens_bind's dry run comes with item 54.
 */
@injectable()
export class TokenRules implements RuleSet {
  readonly #fonts;
  readonly #effects;
  readonly #format;
  readonly #names;

  constructor(
    fonts = inject(FONT_SHORTHAND),
    effects = inject(EFFECTS_GROUP),
    format = inject(NUMBER_FORMAT),
    names = inject(TOKEN_NAMES),
  ) {
    this.#fonts = fonts;
    this.#effects = effects;
    this.#format = format;
    this.#names = names;
  }

  checks(): Partial<Record<LintRuleId, RuleCheck>> {
    return {
      [LINT_RULE.textStyle]: (layer) => this.#textStyle(layer),
      [LINT_RULE.rawNumber]: (layer) => this.#rawNumber(layer),
      [LINT_RULE.offScale]: (layer) => this.#offScale(layer),
      [LINT_RULE.effectStyle]: (layer) => this.#effectStyle(layer),
    };
  }

  /** Texts no text style sets: the build repeats their font where a class should be; each style once. */
  #textStyle({ layer, inInstance }: LintLayer): RuleFinding[] {
    const runs = inInstance ? [] : (layer.text?.segments ?? []).filter((segment) => segment.textStyleId === "");
    const values = [...new Set(runs.map((segment) => this.#textValue(segment)))];

    return values.length === 0
      ? []
      : [
        this.#finding(
          layer,
          LINT_TEXT.noTextStyle(LINT_TEXT.listed(values.map((value) => LINT_TEXT.quoted(value)))),
          LINT_FIX.unknown(values.length === 1, LINT_FIX.textStyle),
        ),
      ];
  }

  /** Shadows and blurs no effect style holds and no variable is bound to. */
  #effectStyle({ layer, parent, model, inInstance }: LintLayer): RuleFinding[] {
    const bound = (layer.effects ?? []).some((effect) => Object.keys(effect.boundVariables ?? {}).length > 0);
    const styled = layer.effectStyleId !== undefined && layer.effectStyleId !== "";
    const value = inInstance || bound || styled ? null : this.#effectsValue(layer, parent, model);

    return value === null
      ? []
      : [this.#finding(layer, LINT_TEXT.raw(value), LINT_FIX.unknown(true, LINT_FIX.effectStyle))];
  }

  /** Spacing, radii, border widths and opacity a variable holds but the layer does not use. */
  #rawNumber({ layer, model, inInstance }: LintLayer): RuleFinding[] {
    const held = (inInstance ? [] : this.#rawNumbers(layer, model)).flatMap(({ field, value, token }) =>
      token === undefined ? [] : [{ pair: LINT_TEXT.pair(field, value), token }],
    );
    const one = held.length === 1;

    return held.length === 0
      ? []
      : [
        this.#finding(
          layer,
          LINT_TEXT.raw(LINT_TEXT.listed(held.map(({ pair }) => pair))),
          LINT_FIX.bound(
            held.map(({ pair, token }) => LINT_FIX.boundPair(one ? LINT_FIX.it : pair, token)).join(LINT_TEXT.joint),
          ),
        ),
      ];
  }

  /** Spacing and radii off the grid, held by no variable; a pill's radius (half its short side) is off it by design. */
  #offScale({ layer, model, inInstance }: LintLayer): RuleFinding[] {
    const pill = (amount: number) => amount >= Math.min(layer.width, layer.height) / 2 - LINT_LIMITS.slack;
    const off = (inInstance ? [] : this.#rawNumbers(layer, model)).filter(
      ({ field, amount, token }) =>
        (OFF_SCALE_FIELDS[field] ?? false) &&
        amount > LINT_GRID.least &&
        amount % LINT_GRID.step !== 0 &&
        token === undefined &&
        !(field === CSS_PROPERTY.borderRadius && pill(amount)),
    );

    return off.length === 0
      ? []
      : [
        this.#finding(
          layer,
          LINT_TEXT.offScale(off.map(({ field, value }) => LINT_TEXT.pair(field, value)).join(LINT_TEXT.joint)),
          LINT_FIX.offScale,
        ),
      ];
  }

  /** A run's style as design_read writes it: the font shorthand, then spacing, case and decoration. */
  #textValue(segment: Segment): string {
    const spacing = this.#fonts.letterSpacing(segment.letterSpacing);
    const transform = CASE_CSS[segment.textCase];
    const decoration = DECORATION_LINES[segment.textDecoration];

    return [
      this.#fonts.font(segment),
      spacing === null ? null : LINT_TEXT.declaration(CSS_PROPERTY.letterSpacing, spacing),
      transform === undefined ? null : LINT_TEXT.declaration(CSS_PROPERTY.textTransform, transform),
      decoration === undefined ? null : LINT_TEXT.declaration(CSS_PROPERTY.textDecoration, decoration),
    ]
      .filter((part) => part !== null)
      .join(LINT_TEXT.parts);
  }

  /** A layer's shadows and blurs as design_read writes them; null with none, or with an effect CSS has no word for. */
  #effectsValue(
    layer: ReadLayer,
    parent: ReadLayer | null,
    model: ReadModel,
  ): string | null {
    const css = new CssDeclarations();

    this.#effects.read({ layer, parent, model, css });

    const { properties, notes } = css.build();

    return properties.length === 0 || notes.some(([property]) => property === EFFECTS_VALUE.effect)
      ? null
      : properties.map(([property, value]) => LINT_TEXT.declaration(property, value)).join(LINT_TEXT.parts);
  }

  /** The raw spacing, padding, radii, border widths and opacity of a layer, each once per value. */
  #rawNumbers(layer: ReadLayer, model: ReadModel): RawNumber[] {
    const stroked = (layer.strokes ?? []).some((paint) => paint.visible ?? true);
    const values = [
      ...this.#singles(layer, model),
      ...LINT_FOUR_FIELDS.flatMap((four) => (!four.stroked || stroked ? this.#four(layer, model, four) : [])),
    ];
    const seen = new Set<string>();

    return values.filter(({ field, value }) => {
      const key = LINT_TEXT.pair(field, value);
      const fresh = !seen.has(key);

      seen.add(key);

      return fresh;
    });
  }

  /** The single number fields the layer's layout uses, bound to no variable; an opacity only between 0 and 1. */
  #singles(layer: ReadLayer, model: ReadModel): RawNumber[] {
    const bound = layer.boundVariables ?? {};

    return Object.entries(LINT_NUMBER_FIELDS).flatMap(([field, { css, needs }]) => {
      const amount: unknown = Reflect.get(layer, field);

      if (typeof amount !== "number" || bound[field] !== undefined || !this.#applies(needs, layer)) {
        return [];
      }

      const shown = css === CSS_PROPERTY.opacity ? amount > 0 && amount < 1 : amount > 0;

      return shown ? [this.#raw(css, [field], amount, { layer, model })] : [];
    });
  }

  /** Whether the layer's layout uses a field: a gap only in a flow that spaces, padding only around a layout. */
  #applies(needs: Needs, layer: ReadLayer): boolean {
    const { layoutMode } = layer;

    switch (needs) {
      case LINT_NEEDS.always:
        return true;
      case LINT_NEEDS.spacing:
        return (
          (layoutMode === LINT_FIGMA.horizontal || layoutMode === LINT_FIGMA.vertical) &&
          layer.primaryAxisAlignItems !== LINT_FIGMA.spaceBetween
        );
      case LINT_NEEDS.wrap:
        return layer.layoutWrap === LINT_FIGMA.wrap;
      case LINT_NEEDS.grid:
        return layoutMode === LINT_FIGMA.grid;
      default:
        return layoutMode !== undefined && layoutMode !== LINT_FIGMA.none;
    }
  }

  /** A radius or border width: the one value of a layer whose four agree, else each corner's or side's own. */
  #four(
    layer: ReadLayer,
    model: ReadModel,
    { single, parts, css }: FourFields,
  ): RawNumber[] {
    const bound = layer.boundVariables ?? {};
    const own: unknown = Reflect.get(layer, single);

    if (typeof own === "number") {
      const fields = [single, ...parts];

      return own <= 0 || fields.some((field) => bound[field] !== undefined)
        ? []
        : [this.#raw(css, fields, own, { layer, model })];
    }

    return parts.flatMap((field) => {
      const amount: unknown = Reflect.get(layer, field);

      return typeof amount === "number" && amount > 0 && bound[field] === undefined
        ? [this.#raw(css, [field], amount, { layer, model })]
        : [];
    });
  }

  /** A raw number with the variable Figma matches to one of its fields, if it found exactly one (C-153). */
  #raw(
    css: string,
    fields: readonly string[],
    amount: number,
    { layer, model }: { readonly layer: ReadLayer; readonly model: ReadModel },
  ): RawNumber {
    const id = fields.map((field) => layer.inferred?.[field]).find((found) => found !== undefined);
    const variable = id === undefined ? undefined : model.variables[id];

    return {
      field: css,
      value: this.#value(css, amount),
      amount,
      token: variable === undefined ? undefined : this.#names.variable(variable),
    };
  }

  /** A number as design_read writes it: an opacity bare, a border width with its fractions, other lengths whole. */
  #value(css: string, amount: number): string {
    if (css === CSS_PROPERTY.opacity) {
      return String(this.#format.round(amount, PRECISION.decimal));
    }

    return LINT_TEXT.px(
      this.#format.round(amount, css === LINT_CSS.borderWidth ? PRECISION.stroke : PRECISION.spacing),
    );
  }

  #finding(
    layer: ReadLayer,
    message: string,
    fix: string,
  ): RuleFinding {
    return { id: layer.id, name: layer.name, message, fix };
  }
}

export const TOKEN_RULES = new InjectionToken<TokenRules>("TokenRules");
