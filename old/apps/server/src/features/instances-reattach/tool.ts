import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { reattachInstances } from "./reattach-instances.ts";
import { InstancesReattachInputSchema, InstancesReattachOutputSchema } from "./schemas.ts";

export function instancesReattachTool({
  plugin,
}: ToolContext): ToolDefinition<typeof InstancesReattachInputSchema, typeof InstancesReattachOutputSchema> {
  return {
    name: "instances_reattach",
    title: "Put detached components back",
    description:
      "Puts frames detached from a component back as instances of it (Figma remembers which, a library's too): where the frame stood, at its size, with its texts (through the component's text properties where they show one), images and hidden layers carried over by layer path; layers only the frame had are named in lost, and the frame is removed. swap makes instances of one component instances of another (a set's variant with the same values). reset takes overrides off instances: look (fills, strokes, effects, radii, spacing back to the component's, texts kept) or all. design_lint names detached frames and overridden instances. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun says what would change).",
    input: InstancesReattachInputSchema,
    output: InstancesReattachOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => reattachInstances(plugin, args),
    changed: ({ dryRun, reattached, swapped, reset }) =>
      !dryRun && reattached.length + swapped.length + reset.length > 0,
  };
}
