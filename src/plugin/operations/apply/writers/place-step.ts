import { inject, injectable } from "@needle-di/core";
import { GEOMETRY, MATRIX_AXIS } from "@/core/kernel/geometry/geometry.constants.ts";
import type { MatrixAxis } from "@/core/kernel/geometry/layer-matrix.ts";
import { type AxisPlacement, PLACEMENT_SPAN } from "@/core/kernel/geometry/placement-span.ts";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_GEOMETRY } from "@/plugin/operations/apply/writers/step-geometry.ts";
import {
  type AXIS_FIELDS,
  LAYOUT_POSITIONING,
  SIZE_AXIS,
  STEP_KEYS,
  WRITERS_TEXT,
} from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_AXIS } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** One axis's placement and the length the layer is placed in. */
interface Along {
  readonly axis: MatrixAxis;
  readonly placement: AxisPlacement;
  readonly span: number;
}

/**
 * An absolute layer's edges (P-151), from design_read's constraint: the offsets give where its unturned box starts and
 * the layer is placed by its centre, as the read measured it; the constraint is kept for the parent's resizes. A group
 * places its layers in its parent's space; a layer on the page is placed by left and top alone.
 */
@injectable()
export class PlaceStep implements WriteStep {
  readonly keys = STEP_KEYS.place;
  readonly capability = null;
  readonly #assign;
  readonly #geometry;
  readonly #spans;

  constructor(
    assign = inject(ASSIGN),
    geometry = inject(STEP_GEOMETRY),
    spans = inject(PLACEMENT_SPAN),
  ) {
    this.#assign = assign;
    this.#geometry = geometry;
    this.#spans = spans;
  }

  write(node: SceneNode, props: FigmaProps): void {
    for (const axis of Object.values(MATRIX_AXIS)) {
      const placement = props[axis];

      if (placement !== undefined) {
        this.#place(node, { axis, placement, span: 0 }, props);
      }
    }
  }

  #place(
    node: SceneNode,
    { axis, placement }: Along,
    props: FigmaProps,
  ): void {
    const parent = node.parent;

    if (parent === null) {
      return;
    }

    const positioning = "layoutPositioning" in node ? node.layoutPositioning : undefined;

    // A layer flows in an auto layout parent unless it is absolute; a section never is.
    if (
      this.#geometry.layout(parent) !== null &&
      (node.type === FIGMA_NODE_TYPE.section || positioning !== LAYOUT_POSITIONING.absolute)
    ) {
      throw new WriteError(WRITERS_TEXT.flows(axis));
    }

    const page = parent.type === FIGMA_NODE_TYPE.page;

    if (page && placement.kind !== INTENT_AXIS.MIN) {
      throw new WriteError(WRITERS_TEXT.onPage);
    }

    // A size given with both edges wins over the end edge, as in CSS: measured from the start edge it fills the span.
    const sized = placement.kind === INTENT_AXIS.STRETCH && props[this.#size(axis)] !== undefined;
    const { start = 0, end = 0 } = placement;
    const span = sized ? start + this.#length(node, axis) + end : this.#parentLength(parent, page, axis);

    this.#along(node, { axis, placement, span });
  }

  /** design_read places a level or standing line by the box it covers; other layers by their unturned box's centre. */
  #along(node: SceneNode, { axis, placement, span }: Along): void {
    const line = this.#levelLine(node);
    const covered = this.#geometry.covered(node, axis);
    const placed = this.#spans.on(placement, { parent: span, own: line ? covered : this.#length(node, axis) });

    if (!line && placed.size !== this.#length(node, axis)) {
      const box = node as FrameNode;

      this.#geometry.resize(
        node,
        axis === MATRIX_AXIS.horizontal ? placed.size : box.width,
        axis === MATRIX_AXIS.vertical ? placed.size : box.height,
      );
    }

    const length = line ? covered : this.#length(node, axis);
    const centre = this.#origin(node, axis, placement) + placed.start + length / 2;

    this.#geometry.centre(node, axis, centre);
  }

  /** A line lying level or standing upright, which design_read measures by the box it covers. */
  #levelLine(node: SceneNode): boolean {
    return (
      node.type === FIGMA_NODE_TYPE.line &&
      (this.#geometry.standing(node) || Math.abs(node.relativeTransform[0][1]) < GEOMETRY.noise)
    );
  }

  /** Where the parent's space starts: a group places its layers in its own parent's; other parents keep a constraint. */
  #origin(
    node: SceneNode,
    axis: MatrixAxis,
    placement: AxisPlacement,
  ): number {
    const parent = node.parent;

    if (parent?.type === FIGMA_NODE_TYPE.group) {
      return axis === MATRIX_AXIS.horizontal ? parent.x : parent.y;
    }

    if (parent?.type !== FIGMA_NODE_TYPE.page && "constraints" in node) {
      this.#assign.set(node as FrameNode, { constraints: { ...node.constraints, [axis]: placement.kind } });
    }

    return 0;
  }

  #length(node: SceneNode, axis: MatrixAxis): number {
    const box = node as FrameNode;

    return axis === MATRIX_AXIS.horizontal ? box.width : box.height;
  }

  #parentLength(
    parent: BaseNode,
    page: boolean,
    axis: MatrixAxis,
  ): number {
    return page || !(SIZE_AXIS.width in parent) ? 0 : this.#length(parent as SceneNode, axis);
  }

  #size(axis: MatrixAxis): keyof typeof AXIS_FIELDS {
    return axis === MATRIX_AXIS.horizontal ? SIZE_AXIS.width : SIZE_AXIS.height;
  }
}
