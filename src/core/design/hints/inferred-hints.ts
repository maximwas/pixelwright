import { InjectionToken, inject, injectable } from "@needle-di/core";
import { HINT_FIGMA, HINT_LABEL, HINT_TEXT } from "@/core/design/hints/hints.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { INFERRED_WORDS } from "@/shared/read-model/read-model.constants.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A raw value Figma matches to a token, and the layers that hold it. */
interface Match {
  readonly word: string;
  readonly value: string;
  readonly token: string;
  readonly examples: string[];
}

/**
 * Raw spacing, radii, strokes and opacity Figma itself matches to one token (inferredVariables, C-153): one hint per
 * token, field word and value, with the layers that use it.
 */
@injectable()
export class InferredHints {
  readonly #names;
  readonly #format;

  constructor(names = inject(TOKEN_NAMES), format = inject(NUMBER_FORMAT)) {
    this.#names = names;
    this.#format = format;
  }

  read(model: ReadModel, layers: readonly ReadLayer[]): string[] {
    const found = new Map<string, Match>();

    for (const layer of layers) {
      for (const [field, id] of Object.entries(layer.inferred ?? {})) {
        const word = INFERRED_WORDS[field];
        const variable = model.variables[id];
        const raw: unknown = Reflect.get(layer, field);

        // A zero is what a layout without that padding or gap has: a hint there would only be noise.
        if (word !== undefined && variable !== undefined && typeof raw === "number" && raw !== 0) {
          const value = this.#value(field, word, raw);
          const token = this.#names.variable(variable);
          const key = JSON.stringify([word, value, token]);
          const match = found.get(key) ?? { word, value, token, examples: [] };
          const label = HINT_LABEL.layer(layer.id, layer.name);

          if (!match.examples.includes(label)) {
            match.examples.push(label);
          }

          found.set(key, match);
        }
      }
    }

    return [...found.values()].map(({ word, value, token, examples }) =>
      HINT_TEXT.inferred(word, value, token, examples),
    );
  }

  /** A raw value as design_read writes it: an opacity bare, a border width with its fractions, other lengths whole. */
  #value(
    field: string,
    word: string,
    raw: number,
  ): string {
    if (field === HINT_FIGMA.opacity) {
      return String(this.#format.round(raw, PRECISION.decimal));
    }

    return HINT_LABEL.px(
      this.#format.round(raw, word === HINT_FIGMA.borderWidth ? PRECISION.stroke : PRECISION.spacing),
    );
  }
}

export const INFERRED_HINTS = new InjectionToken<InferredHints>("InferredHints");
