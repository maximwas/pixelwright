import { DesignAuditSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { auditDesign } from "./audit-design.ts";
import { AuditInputSchema } from "./schemas.ts";

export function designAuditTool({
  plugin,
}: ToolContext): ToolDefinition<typeof AuditInputSchema, typeof DesignAuditSchema> {
  return {
    name: "design_audit",
    title: "Audit the design's scale",
    description:
      "The scale a layer uses (the selected layer by default): spacing (gaps and paddings), radii, font sizes, line heights and colours, each with how often it is used and whether it is bound to a token; and what is off it: values off the 4 px grid, raw colours equal to or a hair from a token, sizes a pixel apart. Use it to define tokens when a file has none, or to see what the build should round.",
    input: AuditInputSchema,
    output: DesignAuditSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => auditDesign(plugin, args),
  };
}
