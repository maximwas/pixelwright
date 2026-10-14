import { BridgeError } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { diffOne } from "./diff-one.ts";
import { everyBaseline } from "./every-baseline.ts";
import { BaselineDiffInputSchema, BaselineDiffOutputSchema } from "./schemas.ts";

export function baselineDiffTool(
  context: ToolContext,
): ToolDefinition<typeof BaselineDiffInputSchema, typeof BaselineDiffOutputSchema> {
  return {
    name: "baseline_diff",
    title: "What changed since a baseline",
    description:
      "What the designer changed since baseline_save, in design_read's terms: each layer changed (its attributes as [before, after], a text's content as XML), added (with its XML when short), removed or hidden, moved to another parent or reordered; a change made in a component once, with the instances it reached and how many were compared (of); tokens whose value changed in any mode, renamed, newly used or no longer used; icons and images drawn anew (drawing: export them again). Layers are followed by id, a replaced one by its name. It sees what changes_since and Figma's own Changed mark miss: edits made while the plugin was closed, accepted library updates, variable and style values. Without name: every baseline in the project with how much changed; call it when a session starts or the user says the design changed. It reads the file the baseline came from and works while Allow edits is off. Change only the code it names (code lists the files), then call baseline_save with the accept it gives.",
    input: BaselineDiffInputSchema,
    output: BaselineDiffOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: async ({ name, node, file }, signal) => {
      context.baselines.folder();

      if (name === undefined) {
        if (node !== undefined) {
          throw new BridgeError(
            "OP_FAILED",
            "node compares one baseline with another layer: give the baseline's name too.",
          );
        }

        return everyBaseline(context, file, signal);
      }

      return diffOne(context, {
        name,
        node,
        file,
      });
    },
  };
}
