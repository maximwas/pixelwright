import { InjectionToken, injectable } from "@needle-di/core";
import type { Summary, TokenCollection, Tokens } from "@/core/tokens/model/model.schema.ts";

/** The first whole tokens of a model that fit, how many they are, and how many the model holds. */
export interface FirstTokens {
  readonly tokens: Tokens;
  readonly shown: number;
  readonly total: number;
}

/**
 * A model too long for one answer (T-161): its map, each collection's modes and number of variables and the styles
 * of each kind, and the most WHOLE tokens that fit, in the model's order, so the rest is read a part at a time.
 */
@injectable()
export class ModelSummary {
  count(tokens: Tokens): Summary {
    return {
      collections: tokens.collections.map(({ name, modes, variables }) => ({
        name,
        modes,
        variables: variables.length,
      })),
      styles: {
        paint: tokens.styles.paint.length,
        text: tokens.styles.text.length,
        effect: tokens.styles.effect.length,
      },
    };
  }

  /** The most whole tokens whose written size is at most maxChars, found by halving the count: one write a step. */
  first(
    tokens: Tokens,
    maxChars: number,
    size: (part: Tokens) => number,
  ): FirstTokens {
    const { collections, styles } = this.count(tokens);
    const total = collections.reduce(
      (sum, { variables }) => sum + variables,
      styles.paint + styles.text + styles.effect,
    );
    let low = 0;
    let high = total;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);

      if (size(this.#cut(tokens, middle)) <= maxChars) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return { tokens: this.#cut(tokens, low), shown: low, total };
  }

  /** The first `limit` variables and styles, in the model's order; a collection past the cut is left out. */
  #cut(tokens: Tokens, limit: number): Tokens {
    let left = limit;
    const take = <Item>(items: readonly Item[]): Item[] => {
      const taken = items.slice(0, left);

      left -= taken.length;

      return taken;
    };
    const collections: TokenCollection[] = [];

    for (const collection of tokens.collections) {
      if (left === 0) {
        break;
      }

      collections.push({ ...collection, variables: take(collection.variables) });
    }

    return {
      collections,
      styles: { paint: take(tokens.styles.paint), text: take(tokens.styles.text), effect: take(tokens.styles.effect) },
    };
  }
}

export const MODEL_SUMMARY = new InjectionToken<ModelSummary>("ModelSummary");
