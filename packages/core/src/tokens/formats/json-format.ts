import type { StyleTokens, TokenCollection } from "../model/types.ts";
import type { TokenFormat } from "./types.ts";

/** The token model's collections and styles as they are: what tokens_apply takes back. */
export const JSON_FORMAT: TokenFormat<{ tokens: { collections: TokenCollection[]; styles: StyleTokens } }> = {
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
};
