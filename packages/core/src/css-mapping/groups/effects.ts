import { Color } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { styleTokenName } from "../../kernel/names.ts";
import { roundTo } from "../../kernel/numbers.ts";
import type { CssContext } from "../../types/css.ts";
import type { SnapshotEffect, SnapshotNode } from "../../types/snapshot.ts";
import type { CssDeclarations } from "../css-declarations.ts";
import type { EffectSpec } from "../figma-props.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../property-group.ts";
import { lengthOf, splitTop, tokenOf } from "../values/css-values.ts";
import { px } from "../values/format.ts";

const EFFECTS = ["box-shadow", "text-shadow", "filter", "backdrop-filter"];

/** The blurs CSS has, as the filter each is and Figma's effect, and the read-only note of a progressive one. */
const BLURS = [
  ["filter", "LAYER_BLUR", "blur"],
  ["backdrop-filter", "BACKGROUND_BLUR", "backdrop-blur"],
] as const;

/**
 * A blur as the CSS declaration Dev Mode writes, `filter: blur(…)` or `backdrop-filter: blur(…)` (Figma's radius is
 * twice CSS's); null for an effect that is no blur.
 */
export function blurDeclaration(effect: SnapshotEffect): readonly [string, string] | null {
  const blur = BLURS.find(([, type]) => type === effect.type);

  return blur === undefined ? null : [blur[0], `blur(${px((effect.radius ?? 0) / 2)})`];
}

/** A layer's visible shadows and blurs as CSS. */
export function readEffects(node: SnapshotNode, css: CssDeclarations, context: CssContext): void {
  const effects = (node.effects ?? []).filter((effect) => effect.visible ?? true);

  readShadows(node, effects, css, context);
  readBlurs(effects, css);
}

/** Shadows as a box-shadow list, top first (an effect style's value, for the tokens). */
export function shadowListCss(effects: readonly SnapshotEffect[], space: ColorSpace = "srgb"): string {
  return effects
    .filter((effect) => (effect.visible ?? true) && (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW"))
    .toReversed()
    .map((effect) => shadowCss(effect, false, space))
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
  const isText = node.type === "TEXT";
  const shadows = effects
    .filter((effect) => effect.type === "DROP_SHADOW" || (effect.type === "INNER_SHADOW" && !isText))
    .toReversed()
    .map((effect) => shadowCss(effect, isText, context.colorSpace))
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
 * Figma's blur radius is twice the CSS one: Dev Mode writes blur(radius / 2). A progressive blur shows its end radius,
 * and how it runs is noted: CSS has no blur that changes across a box.
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

function shadowCss(effect: SnapshotEffect, isText: boolean, space: ColorSpace | undefined): string {
  const parts = [
    effect.type === "INNER_SHADOW" ? "inset" : null,
    px(effect.offset?.x ?? 0),
    px(effect.offset?.y ?? 0),
    px(effect.radius ?? 0),
    isText ? null : px(effect.spread ?? 0),
    effect.color === undefined ? null : Color.of(effect.color, space).css(),
  ];

  return parts.filter((part) => part !== null).join(" ");
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
  const radius = (value: number) => `${Math.round(value / 2)}px`;

  css.readOnly(
    property,
    `progressive from ${radius(effect.startRadius ?? 0)} at ${at(effect.startOffset, {
      x: 0.5,
      y: 0,
    })} to ${radius(effect.radius ?? 0)} at ${at(effect.endOffset, {
      x: 0.5,
      y: 1,
    })}`,
  );
}

/** Shadows and blurs written back as the one list Figma keeps them in. */
export const EFFECTS_RULE: Rule = {
  attributes: EFFECTS,
  write: effectsRule,
};

/**
 * Shadows and blurs are one list in Figma: an attribute the element leaves out keeps what the layer has. An effect
 * style holds every effect, so a blur beside its token is an error.
 */
function effectsRule({ own, merged, changed }: WriteInput, out: WriteOutput): void {
  const shadowAttribute = merged("box-shadow") === undefined ? "text-shadow" : "box-shadow";
  const shadows = merged(shadowAttribute);
  const token = shadows === undefined ? null : tokenOf(shadows);

  if (token !== null) {
    for (const [name] of BLURS.filter(([name]) => changed(name) && own(name) !== "none")) {
      out.fail(name, `The effect style ${token.token} holds every effect: change the style, or write its shadows out.`);
    }

    out.set("effects", token, shadowAttribute);

    return;
  }

  const blurs = blursOf(merged, out);
  const list = blurs === null ? null : shadowsOf(shadowAttribute, shadows, out);

  if (blurs !== null && list !== null) {
    out.set("effects", [...blurs, ...list.toReversed()], EFFECTS.find(changed) ?? shadowAttribute);
  }
}

/** The blurs the filters give (Figma's radius is twice CSS's); null after a filter that is not blur(Npx). */
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
      radius: roundTo(Number(blur[1]) * 2, 4),
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
    const color = Color.parse(words.filter((word) => word !== "inset" && typeof lengthOf(word) !== "number").join(" "));

    if (lengths.length < 2 || lengths.length > 4 || color === null) {
      out.fail(attribute, `"${shadow}" is not a shadow: [inset] x y [blur] [spread] and a colour.`);

      return null;
    }

    const [x = 0, y = 0, radius = 0, spread = 0] = lengths;

    list.push({
      type: words.includes("inset") ? "INNER_SHADOW" : "DROP_SHADOW",
      color: color.value(),
      x,
      y,
      radius,
      spread,
    });
  }

  return list;
}
