import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EFFECTS } from "@/plugin/adapters/figma/effects.ts";
import { PAINTS } from "@/plugin/adapters/figma/paints.ts";
import type {
  EffectStylePlan,
  PaintStylePlan,
  Targets,
  TokenRun,
} from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { VARIABLE_VALUES } from "@/plugin/operations/tokens-apply/variable-values.ts";

/**
 * What a planned paint or effect style becomes in Figma (C-173), by design_apply's own writers: its paints and its
 * shadows with their colour variables bound (P-092, FX-048). A dry run binds nothing: binding a library's variable
 * imports it, which writes to the file.
 */
@injectable()
export class StyleLooks {
  readonly #paints;
  readonly #effects;
  readonly #values;

  constructor(
    paints = inject(PAINTS),
    effects = inject(EFFECTS),
    values = inject(VARIABLE_VALUES),
  ) {
    this.#paints = paints;
    this.#effects = effects;
    this.#values = values;
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
