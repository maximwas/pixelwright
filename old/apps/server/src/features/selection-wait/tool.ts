import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { SelectionWaitInputSchema, SelectionWaitOutputSchema } from "./schemas.ts";
import { waitForSelection } from "./wait-selection.ts";

export function selectionWaitTool({
  plugin,
}: ToolContext): ToolDefinition<typeof SelectionWaitInputSchema, typeof SelectionWaitOutputSchema> {
  return {
    name: "selection_wait",
    title: "Wait for a selection",
    description:
      'Waits until the user selects something in Figma, then answers with the selection, as selection_get does (changed: false when the time ran out first). Tell the user what to select before calling it: "select the card you mean in Figma".',
    input: SelectionWaitInputSchema,
    output: SelectionWaitOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args, signal) => waitForSelection(plugin, args, signal),
  };
}
