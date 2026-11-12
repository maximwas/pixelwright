import type { EDGE_AXIS } from "@/core/images/images.constants.ts";

export type EdgeAxis = (typeof EDGE_AXIS)[keyof typeof EDGE_AXIS];

/** How one image's edges along an axis pair with another's: matched, shifted (by: how far the render's is off),
 * missing in the render, or extra in it. */
export interface EdgeLines {
  readonly matched: number;
  readonly shifted: { readonly reference: number; readonly node: number; readonly by: number }[];
  readonly missing: number[];
  readonly extra: number[];
}
