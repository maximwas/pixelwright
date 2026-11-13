import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EFFECTS } from "@/plugin/adapters/figma/effects.ts";
import { FONT_CATALOG } from "@/plugin/adapters/figma/fonts/font-catalog.ts";
import { PAINTS } from "@/plugin/adapters/figma/paints.ts";
import type {
  EffectStylePlan,
  PaintStylePlan,
  Targets,
  TextStylePlan,
  TokenRun,
} from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { VARIABLE_VALUES } from "@/plugin/operations/tokens-apply/variable-values.ts";

/** A text style's fields as Figma takes them, its face first: Figma sets the rest once that is loaded. */
export interface TextLook {
  readonly fontName: FontName;
  readonly fontSize: number;
  readonly lineHeight: LineHeight;
  readonly letterSpacing?: LetterSpacing;
  readonly textCase?: TextCase;
}

/**
 * What a planned style becomes in Figma (C-173), by design_apply's own writers: a paint style's paints and an effect
 * style's shadows with their colour variables bound (P-092, FX-048), a text style's face found in this Figma (P-077).
 * A dry run finds the fonts and binds nothing: binding a library's variable imports it, which writes to the file.
 */
@injectable()
export class StyleLooks {
  readonly #paints;
  readonly #effects;
  readonly #fonts;
  readonly #values;

  constructor(
    paints = inject(PAINTS),
    effects = inject(EFFECTS),
    fonts = inject(FONT_CATALOG),
    values = inject(VARIABLE_VALUES),
  ) {
    this.#paints = paints;
    this.#effects = effects;
    this.#fonts = fonts;
    this.#values = values;
  }

  /** A new call: fonts may have been installed since the last. */
  start(): void {
    this.#fonts.start();
  }

  /** The paints; null on a dry run. */
  async paints(
    { paints }: PaintStylePlan,
    targets: Targets,
    run: TokenRun,
  ): Promise<Paint[] | null> {
    if (run.dryRun) {
      return null;
    }

    const tokens = paints.flatMap(({ token, stops }) => [token, ...(stops ?? []).map((stop) => stop.token)]);

    return await this.#paints.of(paints, await this.#variables(tokens, targets, run));
  }

  /** The face nearest the plan's family, weight and slant (a dry run's too, so both refuse a family alike). */
  async text({ font, letterSpacing, textCase }: TextStylePlan): Promise<TextLook> {
    return {
      fontName: await this.#fonts.fontName(font),
      fontSize: font.size,
      lineHeight: { ...font.lineHeight } as LineHeight,
      // A text style's spacing is in px or percent: core reads no AUTO spacing from CSS.
      ...(letterSpacing === undefined ? {} : { letterSpacing: letterSpacing as LetterSpacing }),
      ...(textCase === undefined ? {} : { textCase }),
    };
  }

  /**
   * The effects of the types its CSS names merged into the style's of those types (C-103), the others it holds kept
   * where they were: a shadow-only CSS keeps the style's blurs; null on a dry run.
   */
  async effects(
    { effects, covers }: EffectStylePlan,
    held: readonly Effect[],
    targets: Targets,
    run: TokenRun,
  ): Promise<Effect[] | null> {
    if (run.dryRun) {
      return null;
    }

    const covered = (effect: Effect) => covers.some((type) => type === effect.type);
    const variables = await this.#variables(
      effects.map(({ token }) => token),
      targets,
      run,
    );
    const merged = await this.#effects.merged(held.filter(covered), effects, variables);

    held.forEach((effect, index) => {
      if (!covered(effect)) {
        merged.splice(Math.min(index, merged.length), 0, effect);
      }
    });

    return merged;
  }

  /** The colour variables the tokens name, each found once. */
  async #variables(
    tokens: readonly (string | undefined)[],
    targets: Targets,
    run: TokenRun,
  ): Promise<Map<string, Variable>> {
    const variables = new Map<string, Variable>();

    for (const token of new Set(tokens)) {
      if (token !== undefined) {
        variables.set(token, await this.#values.variable(token, targets[token] ?? {}, run));
      }
    }

    return variables;
  }
}

export const STYLE_LOOKS = new InjectionToken<StyleLooks>("StyleLooks");
