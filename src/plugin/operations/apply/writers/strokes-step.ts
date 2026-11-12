import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES, type TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { PAINT_WRITE } from "@/plugin/operations/apply/writers/paint-write.ts";
import { PAINT_FIELD, STEP_KEYS, STROKE } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type StrokeSpec = NonNullable<FigmaProps["strokes"]>;

/**
 * A layer's border as its strokes (P-092): the paints as fills take them, then the weight (one, or per side on the
 * layers that have sides), the alignment and the dashes. A line's stroke is its border, always centred.
 */
@injectable()
export class StrokesStep implements WriteStep {
  readonly keys = STEP_KEYS.strokes;
  readonly capability = CAPABILITY.strokes;
  readonly #paints;
  readonly #capabilities;
  readonly #assign;

  constructor(
    paints = inject(PAINT_WRITE),
    capabilities = inject(CAPABILITIES),
    assign = inject(ASSIGN),
  ) {
    this.#paints = paints;
    this.#capabilities = capabilities;
    this.#assign = assign;
  }

  /** A weight per side is refused before the paint is written, so a stroke is not half written. */
  async check({ strokes }: FigmaProps, layer: TypedLayer): Promise<void> {
    if (strokes === undefined) {
      return;
    }

    if (
      strokes.paints.length > 0 &&
      strokes.weight === undefined &&
      strokes.sides !== undefined &&
      layer.type !== STROKE.line
    ) {
      this.#capabilities.require(layer, CAPABILITY.strokeSides);
    }

    await this.#paints.check(strokes.paints);
  }

  async write(node: SceneNode, { strokes }: FigmaProps): Promise<void> {
    if (strokes === undefined) {
      return;
    }

    const layer = node as FrameNode;
    const paints = await this.#paints.paints(strokes.paints, node);

    if (typeof paints !== "string") {
      this.#paints.set(node, PAINT_FIELD.strokes, paints, layer.strokeStyleId);
    } else if (layer.strokeStyleId !== paints) {
      await layer.setStrokeStyleIdAsync(paints);
    }

    if (strokes.paints.length > 0) {
      this.#shape(layer, strokes, node.type);
    }
  }

  /** The weight, the alignment and the dashes. */
  #shape(
    layer: FrameNode,
    { weight, sides, align, dash }: StrokeSpec,
    type: NodeType,
  ): void {
    if (weight !== undefined || type === STROKE.line) {
      this.#assign.set(layer, { strokeWeight: weight ?? Math.max(sides?.top ?? 0, sides?.left ?? 0, 0) });
    } else if (sides !== undefined) {
      // Every side, an equal one too: the first side set gives the layer weights per side and Figma starts the others
      // at 0, so a side skipped for already reading 1 (a new frame's strokeWeight) ended at 0.
      layer.strokeTopWeight = sides.top;
      layer.strokeRightWeight = sides.right;
      layer.strokeBottomWeight = sides.bottom;
      layer.strokeLeftWeight = sides.left;
    }

    // A CSS border cannot tell inside from centred: a centred stroke stays centred. A line's stroke is always centred.
    if (type !== STROKE.line && !(align === STROKE.inside && layer.strokeAlign === STROKE.center)) {
      this.#assign.set(layer, { strokeAlign: align });
    }

    if (dash !== layer.dashPattern.length > 0) {
      layer.dashPattern = dash ? [...STROKE.dash] : [];
    }
  }
}
