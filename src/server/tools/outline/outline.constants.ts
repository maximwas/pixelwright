/** outline as clients list it (tools.json pins every word), 0.7.0's words. */
export const OUTLINE_TOOL = {
  name: "outline",
  title: "Outline a frame",
  description:
    'The layer tree of a frame, a page or the current page, as light XML: tag (the Figma type), id, name and box (x and y relative to the outlined node) per layer, to `depth` levels; an instance also names its component and variant, so repeated components show. Use it to find the sections of a big frame before reading one with design_read. A layer with `$children="N"` has N children not listed here: outline it on its own.',
} as const;

export const OUTLINE_FIELD = {
  node: "The layer or page id, or 0:0 for the list of pages. Default: the current page.",
  depth: "How many levels below the node to list (1 to 10).",
  nodes: "How many layers the XML lists.",
} as const;
