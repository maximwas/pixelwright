import { SPREAD_DRAWN } from "@/core/css/groups/effects/effects.constants.ts";

/** A layer as the spread rule reads it: its Figma type, whether it clips its content, its fills. */
export interface SpreadLayer {
  readonly type: string;
  readonly clipsContent?: boolean | undefined;
  readonly fills?: unknown;
}

/**
 * Whether Figma draws a shadow's spread on a layer (SPREAD_DRAWN): design_read writes none where it does not, and
 * design_apply notes one it writes there.
 */
export class ShadowSpread {
  draws({ type, clipsContent, fills }: SpreadLayer): boolean {
    if (SPREAD_DRAWN.always.includes(type)) {
      return true;
    }

    const filled =
      Array.isArray(fills) &&
      (fills as readonly { readonly visible?: boolean }[]).some(({ visible }) => visible ?? true);

    return SPREAD_DRAWN.clipped.includes(type) && (clipsContent ?? false) && filled;
  }
}
