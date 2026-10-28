import type { ReadScope, Rule } from "../../property-group.ts";
import { GRID_CELL_RULES, readGridCell } from "./grid-cell.ts";
import { PLACEMENT_RULES, readPlacement } from "./placement.ts";
import { readSize, SIZE_RULES } from "./size.ts";
import { TRANSFORM_RULE } from "./transform.ts";

/** Where a layer is and how big: its transform and placement, its size and limits, its grid cell. */
export function readGeometry(scope: ReadScope): void {
  readSize(scope, readPlacement(scope));
  readGridCell(scope);
}

/** Placement, size, limits, filling, alignment in the parent, the grid cell and the transform, written back. */
export const GEOMETRY_RULES: readonly Rule[] = [...PLACEMENT_RULES, ...SIZE_RULES, ...GRID_CELL_RULES, TRANSFORM_RULE];
