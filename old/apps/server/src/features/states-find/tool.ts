import { StatesSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { findStates } from "./find-states.ts";
import { StatesFindInputSchema } from "./schemas.ts";

export function statesFindTool({
  plugin,
}: ToolContext): ToolDefinition<typeof StatesFindInputSchema, typeof StatesSchema> {
  return {
    name: "states_find",
    title: "Find missing states",
    description:
      "The states a design is drawn in and the ones the build will need that it lacks. Interactive components (buttons, fields, toggles, tabs, links, by their names) used in the scope, or the file's own for \"file\": the states their variants and properties show (hover, focus, pressed, disabled; error for a field, selected for a toggle or tab) and the missing ones. Screens of lists and forms, their frames grouped by name (Inbox, Inbox – Empty, Inbox – Mobile are one): which of empty, loading, error (lists) or error, success (forms) a frame shows and which none does. variants_read gives a component's states as CSS. Works while Allow edits is off.",
    input: StatesFindInputSchema,
    output: StatesSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => findStates(plugin, args),
  };
}
