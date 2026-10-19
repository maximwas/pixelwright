import type { StyleTokens, TokenCollection } from "../model/types.ts";
import type { TokenFormat } from "./types.ts";

interface JsonTokens {
  collections: TokenCollection[];
  styles: StyleTokens;
}

/** The token model's collections and styles as they are: what tokens_apply takes back. */
export const JSON_FORMAT: TokenFormat<{ tokens: JsonTokens }> = {
  write: ({ model }) => {
    const tokens = {
      collections: model.collections,
      styles: model.styles,
    };

    return {
      body: { tokens },
      notes: [],
      size: JSON.stringify(tokens).length,
    };
  },
  start: ({ model }, maxChars) => {
    const all = {
      collections: model.collections,
      styles: model.styles,
    };
    const total =
      all.collections.reduce((sum, collection) => sum + collection.variables.length, 0) +
      all.styles.paint.length +
      all.styles.text.length +
      all.styles.effect.length;
    // The most whole tokens that fit, found by halving the count: one JSON.stringify a step.
    let low = 0;
    let high = total;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);

      if (JSON.stringify(firstTokens(all, middle)).length <= maxChars) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return {
      body: { tokens: firstTokens(all, low) },
      shown: low,
      total,
    };
  },
};

/** The first `limit` variables and styles, in the model's order; a collection past the cut is left out. */
function firstTokens({ collections, styles }: JsonTokens, limit: number): JsonTokens {
  let left = limit;
  const take = <T>(items: readonly T[]): T[] => {
    const taken = items.slice(0, left);

    left -= taken.length;

    return taken;
  };
  const kept: TokenCollection[] = [];

  for (const collection of collections) {
    if (left === 0) {
      break;
    }

    kept.push({
      ...collection,
      variables: take(collection.variables),
    });
  }

  return {
    collections: kept,
    styles: {
      paint: take(styles.paint),
      text: take(styles.text),
      effect: take(styles.effect),
    },
  };
}
