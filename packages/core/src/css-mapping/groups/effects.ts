import { BLUR_PER_RADIUS, TEXT_TYPES } from "../../constants/css.ts";
import { Color, type ColorValue } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { styleTokenName } from "../../kernel/names.ts";
import { decimal, roundTo } from "../../kernel/numbers.ts";
import type { CssContext } from "../../types/css.ts";
import type { SnapshotEffect, SnapshotNode } from "../../types/snapshot.ts";
import type { CssDeclarations } from "../css-declarations.ts";
import type { EffectSpec } from "../figma-props.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../property-group.ts";
import { lengthOf, splitTop, tokenOf } from "../values/css-values.ts";
import { decimalPx, px } from "../values/format.ts";
import { aliasId, boundVariable, colorToken, paintOf } from "../values/paints.ts";

const EFFECTS = ["box-shadow", "text-shadow", "filter", "backdrop-filter"];

/** The blurs CSS has, as the filter each is and Figma's effect, and the read-only note of a progressive one. */
const BLURS = [
  ["filter", "LAYER_BLUR", "blur"],
  ["backdrop-filter", "BACKGROUND_BLUR", "backdrop-blur"],
] as const;

/**
 * A blur as the CSS declaration that looks like Figma's render, `filter: blur(…)` or `backdrop-filter: blur(…)` (CSS's
 * value is BLUR_PER_RADIUS of Figma's radius, not Dev Mode's half); null for an effect that is no blur.
 */
export function blurDeclaration(effect: SnapshotEffect): readonly [string, string] | null {
  const blur = BLURS.find(([, type]) => type === effect.type);

  return blur === undefined ? null : [blur[0], `blur(${decimalPx((effect.radius ?? 0) * BLUR_PER_RADIUS)})`];
}

/** A layer's visible shadows and blurs as CSS. */
export function readEffects(node: SnapshotNode, css: CssDeclarations, context: CssContext): void {
  const effects = (node.effects ?? []).filter((effect) => effect.visible ?? true);

  readShadows(node, effects, css, context);
  readBlurs(effects, css);
}

/**
 * Shadows as a box-shadow list, top first (an effect style's value, for the tokens): a colour bound to a variable
 * `names` has a token for (by id) as its var(), any other as its colour.
 */
export function shadowListCss(
  effects: readonly SnapshotEffect[],
  space: ColorSpace = "srgb",
  names: ReadonlyMap<string, string> = new Map(),
): string {
  return effects
    .filter((effect) => (effect.visible ?? true) && (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW"))
    .toReversed()
    .map((effect) => {
      const name = names.get(aliasId(effect.boundVariables?.color) ?? "");

      return shadowCss(effect, false, name === undefined ? colorCss(effect, space) : `var(${name})`);
    })
    .join(", ");
}

/**
 * Shadows top first: box-shadow (inner ones inset), or a text's text-shadow (which has no inner shadow or spread). An
 * effect style's shadows are its token, their value gathered with the tokens.
 */
function readShadows(
  node: SnapshotNode,
  effects: readonly SnapshotEffect[],
  css: CssDeclarations,
  context: CssContext,
): void {
  const isText = TEXT_TYPES.has(node.type);
  const shadows = effects
    .filter((effect) => effect.type === "DROP_SHADOW" || (effect.type === "INNER_SHADOW" && !isText))
    .toReversed()
    .map((effect) => {
      const variable = boundVariable(effect.boundVariables?.color, context);

      return shadowCss(
        effect,
        isText,
        variable === null ? colorCss(effect, context.colorSpace) : `var(${colorToken(variable, context)})`,
      );
    })
    .join(", ");

  if (shadows === "") {
    return;
  }

  const property = isText ? "text-shadow" : "box-shadow";
  const style = node.effectStyleId === undefined ? undefined : context.styles[node.effectStyleId];

  if (style === undefined) {
    css.set(property, shadows);
  } else {
    const name = styleTokenName(style);

    context.tokens.set(name, shadows);
    css.set(property, `var(${name})`);
  }
}

/**
 * Blurs as blurDeclaration writes them. A progressive blur shows its end radius, and how it runs is noted: CSS has no
 * blur that changes across a box.
 */
function readBlurs(effects: readonly SnapshotEffect[], css: CssDeclarations): void {
  for (const effect of effects) {
    const blur = BLURS.find(([, type]) => type === effect.type);
    const declaration = blurDeclaration(effect);

    if (blur !== undefined && declaration !== null && effect.radius !== undefined) {
      css.set(...declaration);
      progressiveBlur(effect, blur[2], css);
    }
  }
}

/** A shadow as CSS writes it, with its colour as given: a colour, or the var() of its colour variable. */
function shadowCss(effect: SnapshotEffect, isText: boolean, color: string | null): string {
  const parts = [
    effect.type === "INNER_SHADOW" ? "inset" : null,
    px(effect.offset?.x ?? 0),
    px(effect.offset?.y ?? 0),
    px(effect.radius ?? 0),
    isText ? null : px(effect.spread ?? 0),
    color,
  ];

  return parts.filter((part) => part !== null).join(" ");
}

function colorCss(effect: SnapshotEffect, space: ColorSpace | undefined): string | null {
  return effect.color === undefined ? null : Color.of(effect.color, space).css();
}

/** A progressive blur's run, in CSS radii, from where it starts to where it ends (percents of the box). */
function progressiveBlur(effect: SnapshotEffect, property: string, css: CssDeclarations): void {
  if (effect.blurType !== "PROGRESSIVE") {
    return;
  }

  const at = (offset: { x: number; y: number } | undefined, fallback: { x: number; y: number }) => {
    const { x, y } = offset ?? fallback;

    return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
  };
  const radius = (value: number) => `${decimal(value * BLUR_PER_RADIUS)}px`;

  css.readOnly(
    property,
    `progressive from ${radius(effect.startRadius ?? 0)} at ${at(effect.startOffset, {
      x: 0.5,
      y: 0,
    })} to ${radius(effect.radius ?? 0)} at ${at(effect.endOffset, {
      x: 0.5,
      y: 1,
    })}`,
    true,
  );
}

/** Shadows and blurs written back as the one list Figma keeps them in. */
export const EFFECTS_RULE: Rule = {
  attributes: EFFECTS,
  write: effectsRule,
};

/**
 * Shadows and blurs are one list in Figma: an attribute the element leaves out keeps what the layer has. An effect
 * style holds every effect, so a token on the shadows or on a blur binds it, and another effect beside it is an error.
 */
function effectsRule(input: WriteInput, out: WriteOutput): void {
  const { merged, changed } = input;
  const shadowAttribute = merged("box-shadow") === undefined ? "text-shadow" : "box-shadow";
  const shadows = merged(shadowAttribute);

  if (boundStyle(shadowAttribute, input, out)) {
    return;
  }

  const blurs = blursOf(merged, out);
  const list = blurs === null ? null : shadowsOf(shadowAttribute, shadows, out);

  if (blurs !== null && list !== null) {
    out.set("effects", [...blurs, ...list.toReversed()], EFFECTS.find(changed) ?? shadowAttribute);
  }
}

/**
 * The effect style a var() on the shadows or a blur names, the element's own before the layer's, set as the layer's
 * effects; false when none names one.
 */
function boundStyle(shadowAttribute: string, { own, merged, changed }: WriteInput, out: WriteOutput): boolean {
  const attributes = [shadowAttribute, ...BLURS.map(([name]) => name)];
  const tokenIn = (name: string) => tokenOf(merged(name) ?? "");
  const styled =
    attributes.find((name) => changed(name) && tokenIn(name) !== null) ??
    attributes.find((name) => tokenIn(name) !== null);
  const token = styled === undefined ? null : tokenIn(styled);

  if (styled === undefined || token === null) {
    return false;
  }

  const beside = attributes.filter(
    (name) => name !== styled && changed(name) && own(name) !== "none" && tokenIn(name)?.token !== token.token,
  );

  for (const name of beside) {
    out.fail(
      name,
      `The effect style ${token.token} holds every effect: change the style, or write its ${styled === shadowAttribute ? "shadows" : "blur"} out.`,
    );
  }

  out.set("effects", token, styled);

  return true;
}

/** The blurs the filters give (Figma's radius is CSS's over BLUR_PER_RADIUS); null after a filter not blur(Npx). */
function blursOf(merged: AttributeReader, out: WriteOutput): EffectSpec[] | null {
  const effects: EffectSpec[] = [];

  for (const [attribute, type] of BLURS) {
    const value = merged(attribute);

    if (value === undefined || value === "none") {
      continue;
    }

    const blur = /^blur\(\s*(\d*\.?\d+)px\s*\)$/.exec(value);

    if (blur === null) {
      out.fail(attribute, `${attribute}="${value}" is not blur(Npx), the one filter Figma has.`);

      return null;
    }

    effects.push({
      type,
      radius: roundTo(Number(blur[1]) / BLUR_PER_RADIUS, 4),
    });
  }

  return effects;
}

/** The shadows of a box-shadow or text-shadow list, top first as CSS lists them; null after one that is no shadow. */
function shadowsOf(attribute: string, shadows: string | undefined, out: WriteOutput): EffectSpec[] | null {
  const list: EffectSpec[] = [];

  for (const shadow of shadows === undefined || shadows === "none" ? [] : splitTop(shadows, ",")) {
    const words = splitTop(shadow, " ");
    const lengths = words.map(lengthOf).filter((length): length is number => typeof length === "number");
    const color = shadowColor(words.filter((word) => word !== "inset" && typeof lengthOf(word) !== "number").join(" "));

    if (lengths.length < 2 || lengths.length > 4 || color === null || typeof color === "string") {
      out.fail(
        attribute,
        typeof color === "string" ? color : `"${shadow}" is not a shadow: [inset] x y [blur] [spread] and a colour.`,
      );

      return null;
    }

    const [x = 0, y = 0, radius = 0, spread = 0] = lengths;

    list.push({
      type: words.includes("inset") ? "INNER_SHADOW" : "DROP_SHADOW",
      ...color,
      x,
      y,
      radius,
      spread,
    });
  }

  return list;
}

/**
 * A shadow's colour, read as a background's: a colour, or a colour variable's token (no colour); why not, when a token
 * is mixed with transparent (Figma's shadow takes its variable's whole colour), or the shadow's error when it is none.
 */
function shadowColor(value: string): { color: ColorValue | null; token?: string } | string | null {
  const paint = paintOf(value);

  if (paint?.kind === "color") {
    return { color: paint.color };
  }

  if (paint?.kind !== "token") {
    return null;
  }

  return paint.opacity === 1
    ? {
        color: null,
        token: paint.token,
      }
    : `A shadow's colour variable is its whole colour, its alpha too: write var(${paint.token}) alone, or make a variable with that alpha with tokens_apply first.`;
}
