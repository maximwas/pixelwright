import { type InspectViewSchema, inspectView } from "@pixelwright/core";
import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import type { InspectInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

type InspectArgs = z.output<typeof InspectInputSchema>;

/** The layers named, else the selection, inspected by the plugin and put into words by core. */
export async function inspectLayers(
  bridge: ToolContext["bridge"],
  { nodes, relativeTo, file }: InspectArgs,
): Promise<z.output<typeof InspectViewSchema>> {
  const ids = nodes ?? (await runOp(bridge, "selection", null, file)).nodes.map((node) => node.id);

  if (ids.length === 0) {
    throw new Error("Nothing is selected in Figma: select the layers to inspect, or give their ids in nodes.");
  }

  const raw = await runOp(
    bridge,
    "inspect",
    {
      nodes: ids.slice(0, 100),
      ...(relativeTo === undefined ? {} : { relativeTo }),
    },
    file,
  );

  return inspectView(raw);
}
