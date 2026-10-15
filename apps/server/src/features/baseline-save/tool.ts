import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { saveBaseline } from "./save-baseline.ts";
import { BaselineSaveInputSchema, BaselineSaveOutputSchema } from "./schemas.ts";

export function baselineSaveTool(
  context: ToolContext,
): ToolDefinition<typeof BaselineSaveInputSchema, typeof BaselineSaveOutputSchema> {
  return {
    name: "baseline_save",
    title: "Keep a baseline",
    description:
      "Keeps a layer as you build code from it, so baseline_diff can tell later what the designer changed: its read and the values of the tokens it uses, in every mode, go into .pixelwright/baselines/<name>.json in the project (it holds the design's texts: commit the folder to share it, or leave it out of git). Save right after the design_read you build a screen or section from; name it after your code (pricing, plan-card) and list in code the files you build from it. Once your code has the changes a baseline_diff listed, pass the accept it gave: exactly the design it compared is kept, so what the designer changed after it still shows next time. An existing name is replaced only with accept or replace: true; code alone changes its file list. Writes nothing to Figma, so it works while Allow edits is off.",
    input: BaselineSaveInputSchema,
    output: BaselineSaveOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => saveBaseline(context, args),
  };
}
