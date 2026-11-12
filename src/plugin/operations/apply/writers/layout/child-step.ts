import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { STEP_GEOMETRY } from "@/plugin/operations/apply/writers/geometry/step-geometry.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import {
  AXIS_FIELDS,
  LAYOUT_SIZING,
  SIZE_AXIS,
  SIZE_NUMBER,
  STEP_KEYS,
  WRITERS_TEXT,
} from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_LAYOUT_MODE, INTENT_SELF_ALIGN } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Axis = (typeof SIZE_AXIS)[keyof typeof SIZE_AXIS];
type Align = NonNullable<FigmaProps["alignSelf"]>;

/**
 * How a layer sits in its parent's auto layout or grid: flex fills the row's or column's direction, align-self
 * stretches across it or places the layer in its grid cell, justify-self along the cell.
 */
@injectable()
export class ChildStep implements WriteStep {
  readonly keys = STEP_KEYS.child;
  readonly capability = CAPABILITY.size;
  readonly #assign;
  readonly #geometry;

  constructor(assign = inject(ASSIGN), geometry = inject(STEP_GEOMETRY)) {
    this.#assign = assign;
    this.#geometry = geometry;
  }

  write(node: SceneNode, { grow, alignSelf, justifySelf }: FigmaProps): void {
    const mode = this.#geometry.layout(node.parent);
    const grid = mode === INTENT_LAYOUT_MODE.GRID;
    const along: Axis = mode === INTENT_LAYOUT_MODE.VERTICAL ? SIZE_AXIS.height : SIZE_AXIS.width;
    const across: Axis = along === SIZE_AXIS.width ? SIZE_AXIS.height : SIZE_AXIS.width;

    if (grow !== undefined) {
      if (mode === null || grid) {
        throw grid
          ? new WriteError(WRITERS_TEXT.growInGrid, WRITERS_TEXT.growInGridHint)
          : new WriteError(WRITERS_TEXT.growOutside, WRITERS_TEXT.growOutsideHint);
      }

      this.#fill(node, along, grow);
    }

    if (alignSelf !== undefined) {
      this.#alignSelf(node, { mode, across }, alignSelf);
    }

    if (justifySelf !== undefined) {
      if (!grid) {
        throw new WriteError(WRITERS_TEXT.justifyOutside);
      }

      this.#inCell(node, SIZE_AXIS.width, justifySelf);
    }
  }

  /** In a flex parent STRETCH fills across its direction; in a grid, the place in the cell. */
  #alignSelf(
    node: SceneNode,
    { mode, across }: { mode: string | null; across: Axis },
    align: Align,
  ): void {
    if (mode === INTENT_LAYOUT_MODE.GRID) {
      this.#inCell(node, SIZE_AXIS.height, align);
    } else if (mode === null) {
      throw new WriteError(WRITERS_TEXT.alignOutside);
    } else if (align === INTENT_SELF_ALIGN.STRETCH || align === INTENT_SELF_ALIGN.AUTO) {
      this.#fill(node, across, align === INTENT_SELF_ALIGN.STRETCH);
    } else {
      throw new WriteError(WRITERS_TEXT.alignInFlex, WRITERS_TEXT.alignInFlexHint);
    }
  }

  #inCell(
    node: SceneNode,
    axis: Axis,
    align: Align,
  ): void {
    this.#fill(node, axis, align === INTENT_SELF_ALIGN.STRETCH);

    if (align !== INTENT_SELF_ALIGN.STRETCH) {
      this.#assign.set(node as FrameNode, { [AXIS_FIELDS[axis].grid]: align });
    }
  }

  /**
   * Filling the axis, or fixed where it filled. Figma makes a new text 0 wide and leaves it so when it is set to fill
   * (B-047: one letter a line), so such a text is resized once it fills, keeping the fill.
   */
  #fill(
    node: SceneNode,
    axis: Axis,
    fill: boolean,
  ): void {
    const box = node as FrameNode;
    const sizing = AXIS_FIELDS[axis].sizing;

    if (!fill) {
      this.#assign.set(box, { [sizing]: box[sizing] === LAYOUT_SIZING.fill ? LAYOUT_SIZING.fixed : undefined });

      return;
    }

    this.#assign.set(box, { [sizing]: LAYOUT_SIZING.fill });

    if (node.type === FIGMA_NODE_TYPE.text && axis === SIZE_AXIS.width && node.width < SIZE_NUMBER.zeroWidth) {
      this.#geometry.resize(node, SIZE_NUMBER.fillingTextWidth, node.height);
    }
  }
}
