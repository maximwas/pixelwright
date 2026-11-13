import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CHANGE_OF } from "@/core/apply/plan/change-of.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { MODEL_TEXT, STYLE_GROUP, type StyleGroup } from "@/core/tokens/model/model.constants.ts";
import { EFFECT_COVERS, PLAN_PATTERN, PLAN_TEXT, STYLE_ORDER, STYLE_READ } from "@/core/tokens/plan/plan.constants.ts";
import type { StyleInput, TokensInput } from "@/core/tokens/plan/plan.schema.ts";
import type { HeldStyle } from "@/core/tokens/plan/plan.types.ts";
import type { StylePlans as Styles, TokenError, TokenItem } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";
import { INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Paint = Omit<Styles["paint"][number], "name" | "id">;

type Text = Omit<Styles["text"][number], "name" | "id">;

type Effect = Omit<Styles["effect"][number], "name" | "id">;

/** A style's value in Figma's terms, or why its CSS cannot be one. */
type StyleValue = Paint | Text | Effect | { readonly error: string };

/** The styles' plan, what it makes and changes, and what cannot be written. */
export interface StylesPlanned {
  readonly styles: Styles;
  readonly created: TokenItem[];
  readonly updated: TokenItem[];
  readonly errors: TokenError[];
}

/**
 * The call's styles set against the file's (K-020, B-024): each style's CSS read by design_apply's own rules (C-173: a
 * paint style's as a background, a text style's as the font shorthand with its letter spacing and case, an effect
 * style's as shadows with its blurs, or a blur alone), found by name (its token says which of same-named ones), and
 * planned only where the file's reads otherwise, comparing what the call gives. A library's style is never copied.
 */
@injectable()
export class StylePlans {
  readonly #changes;
  readonly #split;
  readonly #names;

  constructor(
    changes = inject(CHANGE_OF),
    split = inject(CSS_SPLIT),
    names = inject(TOKEN_NAMES),
  ) {
    this.#changes = changes;
    this.#split = split;
    this.#names = names;
  }

  plan(styles: TokensInput["styles"], held: readonly HeldStyle[]): StylesPlanned {
    const planned: StylesPlanned = {
      styles: { paint: [], text: [], effect: [] },
      created: [],
      updated: [],
      errors: [],
    };

    for (const group of STYLE_ORDER) {
      for (const style of styles[group]) {
        this.#style(group, style, held, planned);
      }
    }

    return planned;
  }

  #style(
    group: StyleGroup,
    style: StyleInput,
    held: readonly HeldStyle[],
    planned: StylesPlanned,
  ): void {
    const read = this.#read(group, style);
    const found = this.#found(group, style, held);

    if (found !== undefined && this.#holds(group, found, style, read)) {
      return;
    }

    if ("error" in read || (found?.remote ?? false)) {
      const message = "error" in read ? read.error : PLAN_TEXT.library(style.name);

      planned.errors.push({ kind: group, name: style.name, message });

      return;
    }

    (found === undefined ? planned.created : planned.updated).push({ kind: group, name: style.name });
    this.#add(planned.styles, { name: style.name, ...(found === undefined ? {} : { id: found.id }) }, read);
  }

  /** The file's style of the name: the one with the call's token, else its own over a library's. */
  #found(
    group: StyleGroup,
    style: StyleInput,
    held: readonly HeldStyle[],
  ): HeldStyle | undefined {
    const named = held.filter((each) => each.group === group && each.name === style.name);

    return named.find(({ token }) => token === style.token) ?? named.find(({ remote }) => !remote) ?? named[0];
  }

  /** Whether the file's style holds what the call gives: the same CSS, or CSS that reads the same. */
  #holds(
    group: StyleGroup,
    found: HeldStyle,
    style: StyleInput,
    read: StyleValue,
  ): boolean {
    const css = found.css;

    if (css === undefined) {
      return false;
    }

    const also = css.also ?? [];
    const same = (style.also ?? []).every(({ token, value }) =>
      also.some((each) => each.token === token && each.value === value.trim()),
    );

    if (css.value === style.value.trim() && same) {
      return true;
    }

    const now = this.#read(group, { name: css.name, value: css.value, token: found.token, also });

    return !("error" in read) && !("error" in now) && this.#sameValue(read, now);
  }

  /** Whether the file's value is the call's in what the call gives: an effect style's in the types it covers. */
  #sameValue(read: StyleValue, now: StyleValue): boolean {
    if ("covers" in read && "effects" in now) {
      const covered = now.effects.filter(({ type }) => read.covers.includes(type));

      return JSON.stringify(read.effects) === JSON.stringify(covered);
    }

    const held: Readonly<Record<string, unknown>> = now;

    return Object.entries(read).every(([key, value]) => JSON.stringify(value) === JSON.stringify(held[key]));
  }

  /** The style's CSS as design_apply reads it on a layer, or why it cannot be read. */
  #read(group: StyleGroup, style: StyleInput): StyleValue {
    const attributes = this.#attributes(group, style);

    if (typeof attributes === "string") {
      return { error: attributes };
    }

    const { props, errors } = this.#changes.attributesProps(STYLE_READ[group].tag, attributes);

    return errors.length > 0
      ? { error: PLAN_TEXT.joined(errors) }
      : this.#value(group, props, style.value, Object.keys(attributes));
  }

  /** The style's CSS as a layer's attributes: its value, then its `property: value` pieces and also; or why not. */
  #attributes(group: StyleGroup, style: StyleInput): Record<string, string> | string {
    const { attribute, extras } = STYLE_READ[group];
    const takes = extras.length === 0 ? PLAN_TEXT.takesOnly(attribute) : PLAN_TEXT.takes(attribute, extras);
    // A blur alone is listed under its filter's token (--Frost-backdrop-filter): that filter is its value.
    const own = this.#names.token(style.name);
    const first = extras.find((extra) => style.token === MODEL_TEXT.part(own, extra)) ?? attribute;
    const attributes: Record<string, string> = {};
    const pieces = this.#split.split(style.value, CSS_SEPARATOR.semicolon).map((piece) => piece.trim());

    for (const [index, piece] of pieces.filter((each) => each !== "").entries()) {
      const declared = PLAN_PATTERN.declaration.exec(piece);
      const property = declared?.[1] ?? (index === 0 ? first : "");

      if (property !== attribute && !extras.includes(property)) {
        return PLAN_TEXT.notPart(piece, group, takes);
      }

      attributes[property] = declared?.[2] ?? piece;
    }

    for (const extra of style.also ?? []) {
      const property = extras.find((name) => extra.token.endsWith(PLAN_TEXT.suffix(name)));

      if (property === undefined) {
        return PLAN_TEXT.notPart(extra.token, group, takes);
      }

      attributes[property] = extra.value;
    }

    return attributes;
  }

  /** What the style holds of the props its CSS gave a layer; `attributes`, the ones its CSS names. */
  #value(
    group: StyleGroup,
    props: FigmaProps,
    value: string,
    attributes: readonly string[],
  ): StyleValue {
    if (group === STYLE_GROUP.paint) {
      return this.#paint(props, value);
    }

    return group === STYLE_GROUP.text ? this.#text(props, value) : this.#effect(props, value, attributes);
  }

  /** A paint style's colours and colour variables. */
  #paint({ fills }: FigmaProps, value: string): StyleValue {
    if (fills?.some(({ kind }) => kind === INTENT_PAINT.image) ?? false) {
      return { error: PLAN_TEXT.image(value) };
    }

    return fills === undefined || fills.length === 0 ? { error: PLAN_TEXT.noColour } : { paints: fills };
  }

  /** A text style's font, with its letter spacing and case when its CSS gives them (else the style keeps its own). */
  #text({ font, letterSpacing, textCase }: FigmaProps, value: string): StyleValue {
    if (font === undefined) {
      return { error: PLAN_TEXT.notFont(value) };
    }

    return {
      font,
      ...(letterSpacing === undefined ? {} : { letterSpacing }),
      ...(textCase === undefined ? {} : { textCase }),
    };
  }

  /** An effect style's shadows and blurs, and the effect types its CSS names: those it replaces. */
  #effect(
    { effects }: FigmaProps,
    value: string,
    attributes: readonly string[],
  ): StyleValue {
    return effects !== undefined && !Array.isArray(effects)
      ? { error: PLAN_TEXT.namesStyle(value) }
      : { effects: effects ?? [], covers: attributes.flatMap((attribute) => EFFECT_COVERS[attribute] ?? []) };
  }

  #add(
    styles: Styles,
    named: { readonly name: string; readonly id?: string },
    value: Paint | Text | Effect,
  ): void {
    if ("paints" in value) {
      styles.paint.push({ ...named, ...value });
    } else if ("font" in value) {
      styles.text.push({ ...named, ...value });
    } else {
      styles.effect.push({ ...named, ...value });
    }
  }
}

export const STYLE_PLANS = new InjectionToken<StylePlans>("StylePlans");
