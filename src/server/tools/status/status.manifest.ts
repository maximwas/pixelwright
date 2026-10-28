import { TOOL_ANNOTATIONS } from "../../app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "../../app/tool-runner/tool-manifest.types.ts";
import { StatusInputSchema, StatusOutputSchema } from "./status.schema.ts";

export const STATUS_MANIFEST: ToolManifest = {
  name: "status",
  title: "Connection status",
  description:
    "Lists the Figma files whose Pixelwright plugin is connected (name, current page, editor, whether Allow edits is on) and marks the active one: the file whose plugin window was in front last, which every tool uses when no file is named. Call it first, and whenever a tool says no file is connected: hint says what to do. While a plugin waits to be paired, pairing holds the code: tell the user to type it into the Pixelwright window, and never type or send it yourself. probe: true also pings the active file's plugin. key is the file key of figma.com links, given by Figma to private organization plugins only, so it is mostly null: then ask the user for the file's link.",
  input: StatusInputSchema,
  output: StatusOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("./status.tool.ts")).StatusTool,
};
