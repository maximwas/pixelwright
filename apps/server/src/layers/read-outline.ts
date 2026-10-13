import { countOutline, type OperationInput, outlineXml } from "@pixelwright/core";
import { runOp } from "../mcp/run-op.ts";
import type { ToolContext } from "../types/mcp.ts";

/** The layer tree the plugin outlines, as XML, with how many layers it lists. */
export async function readOutline(
  bridge: ToolContext["bridge"],
  { file, ...query }: OperationInput<"outline"> & { file?: string | undefined },
): Promise<{ xml: string; nodes: number }> {
  const { root } = await runOp(bridge, "outline", query, file);

  return {
    xml: outlineXml(root),
    nodes: countOutline(root),
  };
}
