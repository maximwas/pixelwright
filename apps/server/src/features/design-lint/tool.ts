import { DesignLintSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { lintDesign } from "./lint-design.ts";
import { DesignLintInputSchema } from "./schemas.ts";

export function designLintTool({
  plugin,
}: ToolContext): ToolDefinition<typeof DesignLintInputSchema, typeof DesignLintSchema> {
  return {
    name: "design_lint",
    title: "Lint a design against the general rules",
    description:
      "Checks layers, a page or the file against the rules a design should keep before it is built: text contrast below WCAG AA (an error), colours, texts and effects bound to no token or style, frames detached from components, stacks placed by hand that Figma reads as a flow, layers reaching past their parent's flow, grid cell or clip (a text past its column), touch targets under 24 or 44 px, interactive components without hover, focus or disabled states, raw values a token holds, spacing off the 4 px grid, instance overrides of a component's look, default layer names, hidden and empty leftovers. Each finding names its layer, why, and how to fix it with which tool (tokens_bind binds raw values to the tokens holding them). Errors first. A big board linted whole is slow and its read stops at a size budget (the notes name what was left out): give within its frames' ids instead, a list linted frame by frame in one call. Works while Allow edits is off. design_audit lists the scale itself.",
    input: DesignLintInputSchema,
    output: DesignLintSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => lintDesign(plugin, args),
  };
}
