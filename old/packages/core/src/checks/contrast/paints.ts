import type { Channels } from "../../kernel/color/color.ts";
import type { SnapshotNode, SnapshotPaint } from "../../types/snapshot.ts";

/** One paint as contrast sees it: a colour with its alpha, or the kind of fill it is in words. */
export type Layer = Solid | { readonly kind: string };

export interface Solid {
  readonly color: Channels;
  readonly alpha: number;
}

/** What a fill CSS cannot reduce to one colour is, in words. */
const KINDS: Readonly<Record<string, string>> = {
  IMAGE: "an image",
  VIDEO: "a video",
  GRADIENT_LINEAR: "a gradient",
  GRADIENT_RADIAL: "a gradient",
  GRADIENT_ANGULAR: "a gradient",
  GRADIENT_DIAMOND: "a gradient",
};

/** A paint type that is not one colour, in words. */
export function kindOf(type: string | undefined): string {
  return KINDS[type ?? ""] ?? "a fill CSS cannot hold";
}

/** A layer's visible fills, top first, each as a colour with its alpha or the kind of fill it is. */
export function paintLayers(node: SnapshotNode): Layer[] {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  const opacity = node.opacity ?? 1;

  return fills
    .filter((paint) => paint.visible ?? true)
    .toReversed()
    .map((paint): Layer => {
      const solid = solidOf(paint);

      return solid === null
        ? { kind: kindOf(paint.type) }
        : {
            color: solid.color,
            alpha: solid.alpha * opacity,
          };
    });
}

/** The top visible paint as a colour with its alpha; null when it is not a solid. */
export function topSolid(paints: readonly SnapshotPaint[]): Solid | null {
  const visible = paints.filter((paint) => paint.visible ?? true);

  return solidOf(visible.at(-1));
}

function solidOf(paint: SnapshotPaint | undefined): Solid | null {
  if (paint?.type !== "SOLID" || paint.color === undefined) {
    return null;
  }

  return {
    color: paint.color,
    alpha: (paint.opacity ?? 1) * (paint.color.a ?? 1),
  };
}
