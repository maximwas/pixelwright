import type { McpServer } from "@modelcontextprotocol/server";
import { InspectViewSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { inspectLayers } from "../../layers/inspect-layers.ts";
import { InspectInputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

export function registerInspectTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "inspect",
    title: "Inspect layers",
    description:
      "Reads layers as Figma has them, for what design_read's CSS cannot say, without running code (works while Allow edits is off): the layout box and the painted box (centred or outside strokes, shadows and blur reach past it), the fill as a CSS value with the paint style or variables behind it (what a var() in design_read resolves to), how strokes paint (align, per-side weights, dashes, whether auto layout counts them), every effect with Figma's own parameters (a progressive blur's start and end, noise, texture), a text's lines with what ended each (Enter or Shift+Enter) and its line heights (px, auto, percent), how far a layer overflows its parent, its prototype interactions (trigger, destination, transition, duration, easing) and its component's variant. Boxes are measured from relativeTo's top left, so it also measures: give a list of layers and their section.",
    input: InspectInputSchema,
    output: InspectViewSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => inspectLayers(bridge, args),
  });
}
