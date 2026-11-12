import { InjectionToken, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { COVER } from "@/plugin/operations/cover/cover.constants.ts";
import type { ClipSchema, PlacedLayerSchema } from "@/shared/ops/cover/cover.schema.ts";

/** A box on the page, or a clip of a layer: the same four numbers. */
type Box = zod.output<typeof ClipSchema>;
type PlacedLayer = zod.output<typeof PlacedLayerSchema>;

/** A layer as the cover reads it: plain values, its children read only on the way down. */
export interface CoverLayer {
  readonly id: string;
  /** Its box on the page; null for a layer without one. */
  readonly box: Box | null;
  /** Where it paints, its shadows and outside strokes too. */
  readonly painted: Box | null;
  readonly visible: boolean;
  /** Shown as it is: not faded, blended, blurred, turned or a mask. */
  readonly plain: boolean;
  readonly mask: boolean;
  /** Its own fill is opaque: a solid paint at full opacity, on a layer type that fills its box. */
  readonly solid: boolean;
  /** Its largest corner radius. */
  readonly radius: number;
  children(): readonly CoverLayer[];
}

/**
 * The smallest layer that renders a region of a layer as the layer's own render shows it (T-073, B-050): going down
 * through the children that hold the region, with nothing painted after them over it, no mask before them and nothing
 * fading or blurring them, the deepest that covers it with an opaque fill. Rendering it alone gives the same pixels.
 */
@injectable()
export class ClipCover {
  /** The cover of a clip of the root, placed from the root's box; the root itself when nothing inside covers it. */
  cover(root: CoverLayer, clip: Box): PlacedLayer {
    const origin = root.box;

    if (origin === null) {
      return { node: root.id, x: 0, y: 0, width: 0, height: 0 };
    }

    const region = { x: origin.x + clip.x, y: origin.y + clip.y, width: clip.width, height: clip.height };
    const cover = this.#contains(origin, region) && root.plain ? this.#deepest(root, region) : root;
    const box = cover.box ?? origin;

    return { node: cover.id, x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
  }

  /** Down from a layer through the children holding the region, the deepest opaque one; the layer when none is. */
  #deepest(root: CoverLayer, region: Box): CoverLayer {
    let best = root;

    for (let current = this.#holder(root, region); current !== null; current = this.#holder(current, region)) {
      if (this.#opaqueOver(current, region)) {
        best = current;
      }
    }

    return best;
  }

  /** The child holding the region that the region shows alone: nothing after it over the region, no mask before it. */
  #holder(parent: CoverLayer, region: Box): CoverLayer | null {
    const children = parent.children().filter((child) => child.visible);
    const index = children.findLastIndex((child) => child.box !== null && this.#contains(child.box, region));
    const child = children[index];

    if (child === undefined || !child.plain) {
      return null;
    }

    const covered = children
      .slice(index + 1)
      .some((later) => later.painted !== null && this.#overlaps(later.painted, region));
    const masked = children.slice(0, index).some((earlier) => earlier.mask);

    return covered || masked ? null : child;
  }

  /** Its own opaque fill covers the region, the region clear of its rounded corners. */
  #opaqueOver(layer: CoverLayer, region: Box): boolean {
    if (!layer.solid || layer.box === null) {
      return false;
    }

    const { x, y, width, height } = layer.box;
    const by = layer.radius;

    return this.#contains({ x: x + by, y: y + by, width: width - 2 * by, height: height - 2 * by }, region);
  }

  /** Whether a box holds the region, give or take float noise. */
  #contains(box: Box, region: Box): boolean {
    return (
      region.x >= box.x - COVER.edgePx &&
      region.y >= box.y - COVER.edgePx &&
      region.x + region.width <= box.x + box.width + COVER.edgePx &&
      region.y + region.height <= box.y + box.height + COVER.edgePx
    );
  }

  #overlaps(box: Box, region: Box): boolean {
    return (
      box.x < region.x + region.width &&
      region.x < box.x + box.width &&
      box.y < region.y + region.height &&
      region.y < box.y + box.height
    );
  }
}

export const CLIP_COVER = new InjectionToken<ClipCover>("ClipCover");
