import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { applyDesign } from "./apply-design.ts";
import { DesignApplyInputSchema, DesignApplyOutputSchema } from "./schemas.ts";

export function designApplyTool({
  plugin,
  files,
}: ToolContext): ToolDefinition<typeof DesignApplyInputSchema, typeof DesignApplyOutputSchema> {
  return {
    name: "design_apply",
    title: "Write a design",
    description:
      'Writes Pixelwright XML, the format design_read returns, into Figma. An element with id changes that layer: only the attributes it gives, the rest stays as it is (write background="none", width="auto" to hug, display="block" to drop auto layout); under another parent, with before/after or in another order it moves the layer. An element without id creates a layer: Frame, Section, Text, Rectangle, Ellipse, Line; an Instance by component="Name" variant="Prop=Value" props="Label=Text"; a Component (prop, visibleProp and swapProp on its layers make its properties; on the layers of an existing component they bind or add them) or a ComponentSet of Component variants; an Image or Icon from a file (src); copyOf="id" copies a layer and writes the element onto the copy. var(--Name) binds the style or variable of that name; note writes Dev Mode notes; fonts are loaded for you. XML read with design_read and sent back unchanged changes nothing. Each element is written on its own: errors come back with their line and attribute while the rest goes in, and the whole call is one undo step in Figma. The plugin refuses writes while its Allow edits switch is off (dryRun checks without writing). See guide write.',
    input: DesignApplyInputSchema,
    output: DesignApplyOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => applyDesign(plugin, args, { files }),
    changed: ({ dryRun, created, changed }) => !dryRun && created.length + changed.length > 0,
  };
}
