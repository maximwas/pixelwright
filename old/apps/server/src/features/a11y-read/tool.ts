import { A11ySchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { readA11y } from "./read-a11y.ts";
import { A11yReadInputSchema } from "./schemas.ts";

export function a11yReadTool({ plugin }: ToolContext): ToolDefinition<typeof A11yReadInputSchema, typeof A11ySchema> {
  return {
    name: "a11y_read",
    title: "Read a screen's accessibility",
    description:
      "What a screen's markup needs for accessibility, read from the design: its headings with levels (a text style named H2 or Heading 3 at that level, else by size, the largest h1; skipped levels and extra h1s said), its controls with their roles (link when a click goes to a screen or URL, button for other clicks, checkbox, radio, switch, tab, textbox, combobox by the component) and the label a screen reader says (an icon-only control gets an aria-label suggestion; a field's label is the text right before it), its pictures with an alt from their names, controls nested in controls, and where layers placed by hand read in another order than they show. Use it with design_read when you build the screen. contrast_check rates the texts; design_lint checks touch targets. Works while Allow edits is off.",
    input: A11yReadInputSchema,
    output: A11ySchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readA11y(plugin, args),
  };
}
