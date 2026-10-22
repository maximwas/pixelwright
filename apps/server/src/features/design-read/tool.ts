import type { ContentToolDefinition, ToolContext } from "../../types/mcp.ts";
import { readDesign } from "./read-design.ts";
import { DesignReadInputSchema } from "./schemas.ts";

export function designReadTool({
  plugin,
  files,
  projectRoot,
}: ToolContext): ContentToolDefinition<typeof DesignReadInputSchema> {
  return {
    name: "design_read",
    title: "Read a design",
    description:
      "Reads a layer (a section, a card, a screen) as Pixelwright's XML: Figma's layer types as tags, Image and Icon for true assets, TextPath for a text on a path (its text as a Text's, its path as d and where the text starts as start), CSS properties as attributes (var(--Name) where Figma binds a style or variable), ids to read or change a layer later. The first text block is the XML; the second is JSON with tokens (their values), textStyles, fonts, assets (written to assetsDir when given), hints on what the code should bind, truncated (ids of branches left empty to fit maxChars: read each on its own), measurements (the designer's Dev Mode measurements in px) and motion (Figma Motion as CSS @keyframes, a layer's summary being $motion in the XML) when there are any, repeats (with repeats: true, each run of alike neighbours read as its first, $repeat in the XML, and a row of each one's own texts, files and variants) and nearby (with nearby: N, the designer's notes on the canvas around the screen), and, where the project has Figma Code Connect templates (*.figma.ts) or batch files (*.figma.batch.json), codeComponents: the code connected instances render to ({ids, component, template, source, snippet, imports, unread}, the same code once), with imports and codeErrors; such an instance is $code in the XML, without its children: use its code and add what unread names (its own values are its variant and props; read it with node=<its id> for a nested one's); code: false reads it as layers. A layer with position absolute is placed against its parent element: give that parent position: relative. For a big frame, find its sections with outline first. Rebuild the result with the project's own components and tokens.",
    input: DesignReadInputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: (args) => readDesign(plugin, args, files, projectRoot),
  };
}
