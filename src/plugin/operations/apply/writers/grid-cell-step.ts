import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_GEOMETRY } from "@/plugin/operations/apply/writers/step-geometry.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_LAYOUT_MODE } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A grid child's cell (FX-059): its first row and column and how many it spans. */
@injectable()
export class GridCellStep implements WriteStep {
  readonly keys = STEP_KEYS.gridCell;
  readonly capability = CAPABILITY.size;
  readonly #assign;
  readonly #geometry;

  constructor(assign = inject(ASSIGN), geometry = inject(STEP_GEOMETRY)) {
    this.#assign = assign;
    this.#geometry = geometry;
  }

  /**
   * A span that narrows goes before the move and one that widens after it: on the way the child never covers a cell
   * another child takes, which Figma refuses.
   */
  write(node: SceneNode, { gridRow, gridColumn }: FigmaProps): void {
    if (this.#geometry.layout(node.parent) !== INTENT_LAYOUT_MODE.GRID) {
      throw new WriteError(WRITERS_TEXT.cellOutside);
    }

    const cell = node as FrameNode;
    const row = gridRow?.anchor ?? cell.gridRowAnchorIndex;
    const column = gridColumn?.anchor ?? cell.gridColumnAnchorIndex;
    const rowSpan = gridRow?.span;
    const columnSpan = gridColumn?.span;

    this.#assign.set(cell, {
      gridRowSpan: rowSpan !== undefined && rowSpan < cell.gridRowSpan ? rowSpan : undefined,
      gridColumnSpan: columnSpan !== undefined && columnSpan < cell.gridColumnSpan ? columnSpan : undefined,
    });

    if (row !== cell.gridRowAnchorIndex || column !== cell.gridColumnAnchorIndex) {
      cell.setGridChildPosition(row, column);
    }

    this.#assign.set(cell, { gridRowSpan: rowSpan, gridColumnSpan: columnSpan });
  }
}
