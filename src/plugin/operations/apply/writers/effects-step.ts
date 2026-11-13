import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { EFFECTS, type EffectSpec } from "@/plugin/adapters/figma/effects.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND } from "@/plugin/operations/apply/apply.constants.ts";
import { TOKEN_INDEX } from "@/plugin/operations/apply/token-index.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * A layer's shadows and blurs (C-103): merged into what it holds, what CSS cannot write kept (FX-057), a shadow's
 * token bound to its colour variable (FX-048); a whole var() is an effect style.
 */
@injectable()
export class EffectsStep implements WriteStep {
  readonly keys = STEP_KEYS.effects;
  readonly capability = CAPABILITY.effects;
  readonly #tokens;
  readonly #effects;
  readonly #assign;

  constructor(
    tokens = inject(TOKEN_INDEX),
    effects = inject(EFFECTS),
    assign = inject(ASSIGN),
  ) {
    this.#tokens = tokens;
    this.#effects = effects;
    this.#assign = assign;
  }

  async check({ effects }: FigmaProps): Promise<void> {
    if (effects === undefined) {
      return;
    }

    if (!Array.isArray(effects)) {
      await this.#style(effects.token);

      return;
    }

    for (const token of this.#tokenNames(effects)) {
      await this.#tokens.check(token, TOKEN_KIND.colour);
    }
  }

  async write(node: SceneNode, { effects }: FigmaProps): Promise<void> {
    const layer = node as FrameNode;

    if (effects === undefined) {
      return;
    }

    if (!Array.isArray(effects)) {
      const style = await this.#style(effects.token);

      if (layer.effectStyleId !== style) {
        await layer.setEffectStyleIdAsync(style);
      }

      return;
    }

    const variables = new Map<string, Variable>();

    for (const token of this.#tokenNames(effects)) {
      variables.set(token, await this.#tokens.variable(token, TOKEN_KIND.colour));
    }

    this.#assign.set(layer, { effects: await this.#effects.merged(layer.effects, effects, variables, node) });
  }

  async #style(token: string): Promise<string> {
    const style = await this.#tokens.style(token, TOKEN_KIND.effect);

    if (style === null) {
      throw new WriteError(WRITERS_TEXT.noEffectStyle(token));
    }

    return style;
  }

  #tokenNames(effects: readonly EffectSpec[]): Set<string> {
    return new Set(effects.flatMap(({ token }) => (token === undefined ? [] : [token])));
  }
}
