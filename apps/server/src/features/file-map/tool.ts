import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { FileMapInputSchema, FileMapOutputSchema } from "./schemas.ts";

export function fileMapTool({
  plugin,
}: ToolContext): ToolDefinition<typeof FileMapInputSchema, typeof FileMapOutputSchema> {
  return {
    name: "file_map",
    title: "Map the file",
    description:
      "Every page of the file with its top layers (frames, sections, components) and, inside each section, its own, with their types and sizes, in one call: where to start in a big file. Pages load one at a time; past the time a call has, more: true and the rest are left out (outline them one by one).",
    input: FileMapInputSchema,
    output: FileMapOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file }) => plugin.run("file_map", null, file),
  };
}
