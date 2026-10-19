import {
  type EffectStylePlan,
  letterSpacingCss,
  lineHeightCss,
  type PaintSpec,
  type PaintStylePlan,
  px,
  sameValue,
  type TextStylePlan,
  weightOf,
} from "@pixelwright/core";
import { effectKey, effectsOf, mergedEffects } from "../../../figma/effects.ts";
import { paintsOf, samePaints } from "../../../figma/paints.ts";
import type { TokenIndex } from "../../../figma/tokens/token-index.ts";
import { WriteError } from "../../../figma/write-error.ts";
import type { TokenRun } from "./token-run.ts";

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

/** The text style's value: its face, size and line height, and the spacing and case the plan gives. */
interface TextValue {
  readonly fontName: FontName;
  readonly fontSize: number;
  readonly lineHeight: LineHeight;
  readonly letterSpacing?: LetterSpacing;
  readonly textCase?: TextCase;
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
  holds: (style, paints) => paints !== null && samePaints(style.paints, paints),
  make: () => figma.createPaintStyle(),
  write: (style, paints) => {
    if (paints !== null) {
      style.paints = paints;
    }
  },
};

export const TEXT_STYLES: StyleKind<TextStylePlan, TextStyle, TextValue> = {
  kind: "text",
  spec: ({ font, letterSpacing, textCase }) => ({
    font,
    ...(letterSpacing === undefined ? {} : { letterSpacing }),
    ...(textCase === undefined ? {} : { textCase }),
  }),
  local: () => figma.getLocalTextStylesAsync(),
  next: async (plan, held, run) => ({
    ...(await textFace(plan, held, run)),
    ...textExtras(plan, held),
  }),
  holds: (style, value) =>
    style.fontName.family === value.fontName.family &&
    style.fontName.style === value.fontName.style &&
    style.fontSize === value.fontSize &&
    sameValue(style.lineHeight, value.lineHeight) &&
    (value.letterSpacing === undefined || sameValue(style.letterSpacing, value.letterSpacing)) &&
    (value.textCase === undefined || style.textCase === value.textCase),
  make: () => figma.createTextStyle(),
  write: (style, value) => {
    style.fontName = value.fontName;
    style.fontSize = value.fontSize;
    style.lineHeight = value.lineHeight;

    if (value.letterSpacing !== undefined) {
      style.letterSpacing = value.letterSpacing;
    }

    if (value.textCase !== undefined) {
      style.textCase = value.textCase;
    }
  },
};

/** A text style's face, size and line height, loaded for writing. */
async function textFace(
  { font }: TextStylePlan,
  held: TextStyle | null,
  run: TokenRun,
): Promise<Pick<TextValue, "fontName" | "fontSize" | "lineHeight">> {
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
}

/** The spacing and case the plan gives; a spacing that renders the same as the style's stays the style's. */
function textExtras(
  { letterSpacing, textCase }: TextStylePlan,
  held: TextStyle | null,
): Pick<TextValue, "letterSpacing" | "textCase"> {
  const spacing =
    held !== null &&
    letterSpacing !== undefined &&
    letterSpacingCss({ ...held.letterSpacing }) === letterSpacingCss(letterSpacing)
      ? held.letterSpacing
      : letterSpacing;

  return {
    ...(spacing === undefined ? {} : { letterSpacing: spacing }),
    ...(textCase === undefined ? {} : { textCase }),
  };
}

export const EFFECT_STYLES: StyleKind<EffectStylePlan, EffectStyle, Effect[]> = {
  kind: "effect",
  spec: ({ effects, covers }) => ({
    effects,
    covers,
  }),
  local: () => figma.getLocalEffectStylesAsync(),
  // What the CSS names is replaced, the rest kept: tokens_read shows only shadows, so its CSS keeps a style's blurs.
  next: async ({ effects, covers }, held) => mergedEffects(held?.effects ?? [], effectsOf(effects), new Set(covers)),
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
    for (const stop of spec.kind === "gradient" ? spec.stops : []) {
      if (stop.token !== undefined) {
        await index.find(stop.token, "COLOR");
      }
    }

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
