import { type Breakpoints, breakpointsOf } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { BreakpointsInputSchema } from "./schemas.ts";

/** The screen a layer is on, found again at the page's other widths. */
export async function findBreakpoints(
  plugin: PluginClient,
  { node, file }: z.output<typeof BreakpointsInputSchema>,
): Promise<Breakpoints> {
  return breakpointsOf(await plugin.run("screens", { node }, file));
}
