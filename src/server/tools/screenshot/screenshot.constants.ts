import { LIMITS } from "@/shared/limits/limits.constants.ts";

/** screenshot as clients list it (tools.json pins every word), 0.7.0's words. */
export const SCREENSHOT_TOOL = {
  name: "screenshot",
  title: "Screenshot a layer",
  description: `Renders a layer to PNG so you can see it: a section to build, or your result to check. Returned inline at most ${LIMITS.inlineImageSidePx} px on a side: a larger layer comes scaled down to fit, and the text says its full size. For details of a tall layer screenshot one section of it (outline lists them), or pass clip for a region of it; pass save to write the PNG full size to a file instead.`,
} as const;

export const SCREENSHOT_FIELD = {
  node: "The layer's id, e.g. 54:243.",
  scale: "Pixels per Figma pixel: 2 for a sharp look, below 1 to fit.",
  effects: "Include shadows and outside strokes around the layer; false renders only its own box.",
  save: "Write the PNG to this file (any size) instead of returning it. A relative path starts in the project folder: the MCP client's root, else CLAUDE_PROJECT_DIR, else the server's working directory.",
  clip: "Only this region of the layer, in Figma px from its box's top left (before scale); with effects on it may reach into what paints around the box.",
} as const;

/** A screenshot's defaults, and the longest save path: a file system's own limit. */
export const SCREENSHOT = { scale: 1, effects: true, pathChars: 4_096 } as const;
