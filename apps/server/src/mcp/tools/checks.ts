import type { McpServer } from "@modelcontextprotocol/server";
import { ContrastSchema, DesignAuditSchema } from "@pixelwright/core";
import { auditDesign } from "../../checks/audit-design.ts";
import { checkContrast } from "../../checks/contrast-check.ts";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { checkFonts } from "../../fonts/check-fonts.ts";
import {
  AuditInputSchema,
  ContrastInputSchema,
  FontsCheckInputSchema,
  FontsCheckOutputSchema,
} from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

export function registerChecksTools(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "contrast_check",
    title: "Check text contrast",
    description:
      "Rates every visible text under a layer for WCAG contrast against what is behind it (the layers below it that cover it, then its parents' fills, see-through ones laid over what is below): the ratio, whether it is large text (24 px, or 18.66 px bold), and whether it passes AA and AAA. A text over an image or a gradient is said, not guessed: check those in a screenshot. Works while Allow edits is off.",
    input: ContrastInputSchema,
    output: ContrastSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => checkContrast(bridge, args),
  });
  registerTool(server, {
    name: "fonts_check",
    title: "Check the fonts",
    description:
      "The fonts a layer's texts use (the selected layer's by default), by family with the weights used, and where the build gets each: whether Google Fonts serves it, with a ready css2 link for those weights, and the weights it lacks; a family Google Fonts does not have needs its own files. Google Fonts' public catalogue is read once (no key); offline, the fonts are still listed.",
    input: FontsCheckInputSchema,
    output: FontsCheckOutputSchema,
    annotations: {
      ...READ_ONLY_ANNOTATIONS,
      openWorldHint: true,
    },
    run: (args) => checkFonts(bridge, args),
  });
  registerTool(server, {
    name: "design_audit",
    title: "Audit the design's scale",
    description:
      "The scale a layer uses (the selected layer by default): spacing (gaps and paddings), radii, font sizes, line heights and colours, each with how often it is used and whether it is bound to a token; and what is off it: values off the 4 px grid, raw colours equal to or a hair from a token, sizes a pixel apart. Use it to define tokens when a file has none, or to see what the build should round.",
    input: AuditInputSchema,
    output: DesignAuditSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => auditDesign(bridge, args),
  });
}
