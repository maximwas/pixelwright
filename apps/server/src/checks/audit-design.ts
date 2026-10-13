import { type DesignAudit, designAudit } from "@pixelwright/core";
import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import { selectedLayer } from "../mcp/selected-layer.ts";
import type { AuditInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

/** The scale a layer uses (the selected layer by default), and what is off it. */
export async function auditDesign(
  bridge: ToolContext["bridge"],
  { node, file }: z.output<typeof AuditInputSchema>,
): Promise<DesignAudit> {
  const id = node ?? (await selectedLayer(bridge, file));

  return designAudit(
    await runOp(
      bridge,
      "snapshot",
      {
        node: id,
        css: "none",
      },
      file,
    ),
  );
}
