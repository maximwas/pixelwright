import type { TokenFormat } from "../types.ts";
import { dtcgTrees } from "./dtcg-trees.ts";

/** Design Tokens Format trees, one per collection mode and one of styles, with what DTCG could not hold in notes. */
export const DTCG_FORMAT: TokenFormat = {
  write: ({ raw, filter }) => {
    const { trees, notes } = dtcgTrees(raw, filter);

    return {
      body: { dtcg: trees },
      notes,
      size: JSON.stringify(trees).length,
    };
  },
};
