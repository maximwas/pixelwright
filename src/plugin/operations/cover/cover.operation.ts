import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { CLIP_COVER, type CoverLayer } from "@/plugin/operations/cover/clip-cover.ts";
import { COVER, COVER_TEXT } from "@/plugin/operations/cover/cover.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { coverOp } from "@/shared/ops/cover/cover.manifest.ts";

type CoverInput = zod.output<typeof coverOp.input>;
type CoverOutput = zod.output<typeof coverOp.output>;

/**
 * Where a clip of a layer is cut from (T-073, O-014), measured before anything renders: the layer's box, what its
 * export covers (with effects, its render bounds), and ClipCover's choice over the layer's tree read as plain values.
 */
@injectable()
export class CoverOperation extends Operation<CoverInput, CoverOutput> {
  readonly #lookup;
  readonly #cover;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    cover = inject(CLIP_COVER),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#cover = cover;
  }

  protected async execute({ node: id, clip, effects }: CoverInput): Promise<CoverOutput> {
    const node = await this.#lookup.existing(id);
    const root = this.#layer(node);

    if (root.box === null) {
      throw new PixelwrightError(ERROR_CODE.opFailed, COVER_TEXT.noBox(id, node.type));
    }

    return {
      box: root.box,
      rendered: effects ? (root.painted ?? root.box) : root.box,
      cover: this.#cover.cover(root, clip),
    };
  }

  /** A Figma layer as plain values; its children read only when the cover goes down to them. */
  #layer(node: BaseNode): CoverLayer {
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    return {
      id: node.id,
      box,
      painted: ("absoluteRenderBounds" in node ? node.absoluteRenderBounds : null) ?? box,
      visible: !("visible" in node) || node.visible,
      plain: this.#plain(node),
      mask: "isMask" in node && node.isMask,
      solid: this.#solid(node),
      radius: this.#radius(node),
      children: () => ("children" in node ? node.children.map((child) => this.#layer(child)) : []),
    };
  }

  /** Shown as it is: not faded, blended, blurred, turned, or a mask. */
  #plain(node: BaseNode): boolean {
    const opacity = "opacity" in node ? node.opacity : 1;
    const blend = "blendMode" in node ? node.blendMode : COVER.normal;
    const effects = "effects" in node ? node.effects : [];
    const rotation = "rotation" in node ? node.rotation : 0;

    return (
      opacity === 1 &&
      COVER.blends.includes(blend) &&
      !effects.some((effect) => effect.visible && COVER.blurs.includes(effect.type)) &&
      Math.abs(rotation) <= COVER.turnDegrees &&
      !("isMask" in node && node.isMask)
    );
  }

  /** An opaque solid fill, on a layer type that fills its box. */
  #solid(node: BaseNode): boolean {
    if (!COVER.filled.includes(node.type) || !("fills" in node) || !Array.isArray(node.fills)) {
      return false;
    }

    return (node.fills as readonly Paint[]).some(
      (paint) =>
        paint.type === COVER.solid &&
        (paint.visible ?? true) &&
        (paint.opacity ?? 1) === 1 &&
        (paint.blendMode === undefined || paint.blendMode === COVER.normal),
    );
  }

  /** The largest corner radius: a region in a rounded corner is not covered. */
  #radius(node: BaseNode): number {
    const radii: unknown[] = [];

    if ("cornerRadius" in node) {
      radii.push(node.cornerRadius);
    }

    if ("topLeftRadius" in node) {
      radii.push(node.topLeftRadius, node.topRightRadius, node.bottomLeftRadius, node.bottomRightRadius);
    }

    return Math.max(0, ...radii.filter((radius): radius is number => typeof radius === "number"));
  }
}
