import type { TokenModel } from "./types.ts";

/** What a token model holds, counted: each collection's modes and number of variables, and the styles of each kind. */
export interface ModelSummary {
  readonly collections: readonly {
    readonly name: string;
    readonly modes: readonly string[];
    readonly variables: number;
  }[];
  readonly styles: { readonly paint: number; readonly text: number; readonly effect: number };
}

/** The model counted: a map of the tokens to read a part at a time when the whole is too long. */
export function modelSummary(model: TokenModel): ModelSummary {
  return {
    collections: model.collections.map((collection) => ({
      name: collection.name,
      modes: collection.modes,
      variables: collection.variables.length,
    })),
    styles: {
      paint: model.styles.paint.length,
      text: model.styles.text.length,
      effect: model.styles.effect.length,
    },
  };
}
