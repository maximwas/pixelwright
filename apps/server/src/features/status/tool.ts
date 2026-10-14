import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { readStatus } from "./read-status.ts";
import { StatusInputSchema, StatusOutputSchema } from "./schemas.ts";

export function statusTool({
  bridge,
  version,
}: ToolContext): ToolDefinition<typeof StatusInputSchema, typeof StatusOutputSchema> {
  return {
    name: "status",
    title: "Connection status",
    description:
      "Lists the Figma files whose Pixelwright plugin is connected (name, current page, editor, whether Allow edits is on) and marks the active one: the file whose plugin window was in front last, which every tool uses when no file is named. Call it first, and whenever a tool says no file is connected: hint says what to do. While a plugin waits to be paired, pairing holds the code: tell the user to type it into the Pixelwright window, and never type or send it yourself. probe: true also pings the active file's plugin.",
    input: StatusInputSchema,
    output: StatusOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: ({ probe }) => readStatus(bridge, version, probe),
  };
}
