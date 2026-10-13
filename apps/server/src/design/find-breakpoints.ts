import { type Breakpoints, breakpointsOf } from "@pixelwright/core";
import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import type { BreakpointsInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

/** The screen a layer is on, found again at the page's other widths. */
export async function findBreakpoints(
  bridge: ToolContext["bridge"],
  { node, file }: z.output<typeof BreakpointsInputSchema>,
): Promise<Breakpoints> {
  return breakpointsOf(await runOp(bridge, "screens", { node }, file));
}
