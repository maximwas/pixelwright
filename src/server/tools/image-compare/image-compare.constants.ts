/** image_compare as clients list it (tools.json pins every word), 0.7.0's words. */
export const IMAGE_COMPARE_TOOL = {
  name: "image_compare",
  title: "Compare a layer with an image or a layer",
  description:
    "Renders a layer as screenshot does (scale, effects and clip alike) and compares it with a PNG on disk, typically a screenshot of your build at the same size, or with another layer (against) rendered the same way, a variant against its default or a rebuilt frame against the original: rmse (0 to 255) and the share of differing pixels over the part both cover, the box around the differences, and the edges: each horizontal (rows, by y) and vertical (columns, by x) edge of the reference matched, shifted by a few px (by: how far the render's is off), missing, or extra in the render. diff writes a PNG of the difference. Take the reference at the render's density (scale 2 for a 2x screenshot). Works while Allow edits is off.",
} as const;

export const IMAGE_COMPARE_FIELD = {
  node: "The layer's id, e.g. 54:243.",
  reference:
    "The PNG to compare with, e.g. a screenshot of your build at the same size: its path. A relative path starts in the project folder: the MCP client's root, else CLAUDE_PROJECT_DIR, else the server's working directory.",
  against:
    "Another layer's id to compare with instead of a PNG, rendered the same way: a variant against its default, a rebuilt frame against the original.",
  scale: "Pixels per Figma pixel of the render: the reference's density.",
  effects: "Render shadows and outside strokes around the layer; false renders only its own box.",
  clip: "Only this region of the layer, in Figma px from its box's top left (before scale); with effects on it may reach into what paints around the box.",
  diff: "A .png path to write the difference to: the render faded, every differing pixel red. A relative path starts in the project folder: the MCP client's root, else CLAUDE_PROJECT_DIR, else the server's working directory.",
  rmse: "Root mean square colour difference, 0 to 255, both images over white.",
  different: "The share of pixels that differ by more than antialiasing does, 0 to 1.",
  box: "The box around every differing pixel, in px of the render; null when none differs.",
  rows: "Horizontal edges by y: matched, shifted (by: + is lower in the render), missing, extra.",
  columns: "Vertical edges by x: matched, shifted (by: + is further right in the render).",
} as const;

/** A comparison's defaults, and the longest path: a file system's own limit. */
export const IMAGE_COMPARE = { scale: 1, effects: true, pathChars: 4_096 } as const;

const COVERED = "only the part both cover from the top left is compared, and edges past it count as missing or extra.";

/** 0.7.0's words (T-089). */
export const IMAGE_COMPARE_TEXT = {
  both: "Give reference or against, one of them: a PNG or another layer.",
  neither: "Give reference, a PNG of your build, or against, another layer's id, to compare the layer with.",
  size: (width: number, height: number) => `${width}×${height}`,
  sizesDiffer: ({ node, reference }: { node: string; reference: string }, scale: number) =>
    `The sizes differ (render ${node}, reference ${reference}): ${COVERED} Take the reference at scale ${scale} and the layer's size, or clip the render.`,
  layersDiffer: ({ node, reference }: { node: string; reference: string }, against: string) =>
    `The sizes differ (render ${node}, ${against} ${reference}): ${COVERED} Clip both to one region to compare it alone.`,
} as const;
