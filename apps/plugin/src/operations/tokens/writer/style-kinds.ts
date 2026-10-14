import {
  type EffectStylePlan,
  lineHeightCss,
  type PaintSpec,
  type PaintStylePlan,
  px,
  sameValue,
  type TextStylePlan,
  weightOf,
} from "@pixelwright/core";
import { effectKey, effectsOf, mergedEffects, paintsOf } from "../../../figma/apply-props.ts";
import type { TokenIndex } from "../../../figma/tokens/token-index.ts";
import { WriteError } from "../../../figma/write-error.ts";
import type { TokenRun } from "./token-run.ts";

/** Effects an effect style's CSS shows: its shadows (tokens_read leaves blurs out, so a write keeps them). */
const STYLE_EFFECTS: ReadonlySet<string> = new Set(["DROP_SHADOW", "INNER_SHADOW"]);

/**
 * How one kind of style is written: what core read its CSS as, Figma's local styles of the kind, the value a planned
 * style becomes (keeping what CSS cannot show from the style it changes), and how that value is held and set.
 */
export interface StyleKind<Plan extends { readonly name: string }, Style extends BaseStyle, Value> {
  readonly kind: "paint" | "text" | "effect";
  /** The plan's value as core's reader gives it, to compare with what tokens_read shows. */
  spec(plan: Plan): object;
  local(): Promise<Style[]>;
  next(plan: Plan, style: Style | null, run: TokenRun): Promise<Value>;
  /** Whether a style holds the value already, exactly: nothing to write. */
  holds(style: Style, value: Value): boolean;
  make(): Style;
  write(style: Style, value: Value): void;
}

/** The text style's value: its face, size and line height. */
interface TextValue {
  readonly fontName: FontName;
  readonly fontSize: number;
  readonly lineHeight: LineHeight;
}

export const PAINT_STYLES: StyleKind<PaintStylePlan, PaintStyle, Paint[] | null> = {
  kind: "paint",
  spec: ({ paints }) => ({ paints }),
  local: () => figma.getLocalPaintStylesAsync(),
  next: async ({ paints }, _style, run) => {
    // A dry run only checks the tokens: binding a library colour would import it, which writes to the file.
    if (run.dryRun) {
      await checkPaints(paints, await run.index());

      return null;
    }

    const resolved = await paintsOf(paints, { tokens: () => run.index() });

    if ("style" in resolved) {
      throw new WriteError("A paint style holds paints: it cannot point at another paint style.");
    }

    return resolved.paints;
  },
  holds: (style, paints) => paints !== null && sameValue(paintKeys(style.paints), paintKeys(paints)),
  make: () => figma.createPaintStyle(),
  write: (style, paints) => {
    if (paints !== null) {
      style.paints = paints;
    }
  },
};

export const TEXT_STYLES: StyleKind<TextStylePlan, TextStyle, TextValue> = {
  kind: "text",
  spec: ({ font }) => ({ font }),
  local: () => figma.getLocalTextStylesAsync(),
  next: async ({ font }, held, run) => {
    // Its own face first: a condensed or variable face reads as its family and weight only.
    const fontName = await run.fonts.fontNameOf(
      font,
      held === null
        ? []
        : [
            {
              fontName: held.fontName,
              weight: weightOf(held.fontName.style),
            },
          ],
    );
    // A size or line height that renders the same as the style's stays the style's (tokens_read rounds both).
    const fontSize = held !== null && px(held.fontSize) === px(font.size) ? held.fontSize : font.size;
    const lineHeight =
      held !== null && lineHeightCss(held.lineHeight, fontSize) === lineHeightCss(font.lineHeight, fontSize)
        ? held.lineHeight
        : font.lineHeight;

    if (!run.dryRun) {
      await figma.loadFontAsync(fontName);
    }

    return {
      fontName,
      fontSize,
      lineHeight,
    };
  },
  holds: (style, value) =>
    style.fontName.family === value.fontName.family &&
    style.fontName.style === value.fontName.style &&
    style.fontSize === value.fontSize &&
    sameValue(style.lineHeight, value.lineHeight),
  make: () => figma.createTextStyle(),
  write: (style, value) => {
    style.fontName = value.fontName;
    style.fontSize = value.fontSize;
    style.lineHeight = value.lineHeight;
  },
};

export const EFFECT_STYLES: StyleKind<EffectStylePlan, EffectStyle, Effect[]> = {
  kind: "effect",
  spec: ({ effects }) => ({ effects }),
  local: () => figma.getLocalEffectStylesAsync(),
  next: async ({ effects }, held) => mergedEffects(held?.effects ?? [], effectsOf(effects), STYLE_EFFECTS),
  holds: (style, effects) => sameValue(style.effects.map(effectKey), effects.map(effectKey)),
  make: () => figma.createEffectStyle(),
  write: (style, effects) => {
    style.effects = effects;
  },
};

/** What paintsOf would refuse, checked without binding a variable: a paint style inside another, a token of nothing. */
async function checkPaints(specs: readonly PaintSpec[], index: TokenIndex): Promise<void> {
  const [only] = specs;

  if (
    specs.length === 1 &&
    only?.kind === "token" &&
    only.opacity === 1 &&
    (await index.style(only.token, "PAINT")) !== null
  ) {
    throw new WriteError("A paint style holds paints: it cannot point at another paint style.");
  }

  for (const spec of specs) {
    if (spec.kind !== "token") {
      continue;
    }

    if ((await index.style(spec.token, "PAINT")) !== null) {
      throw new WriteError(
        `${spec.token} is a paint style, which is the whole list of a layer's paints.`,
        "Use it as the only layer, without color-mix().",
      );
    }

    await index.find(spec.token, "COLOR");
  }
}

/** The parts of paints that make them look as they do. */
function paintKeys(paints: readonly Paint[]): unknown[] {
  return paints.map((paint) => {
    const solid = paint as Partial<SolidPaint>;

    return [
      paint.type,
      paint.visible ?? true,
      paint.opacity ?? 1,
      solid.color === undefined ? null : [solid.color.r, solid.color.g, solid.color.b],
      solid.boundVariables?.color?.id ?? null,
    ];
  });
}
