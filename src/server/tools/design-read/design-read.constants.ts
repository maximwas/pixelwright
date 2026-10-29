/** design_read as clients list it (tools.json pins every word): 0.7.0's words for what this build reads. */
export const DESIGN_READ_TOOL = {
  name: "design_read",
  title: "Read a design",
  description:
    'Reads a layer (a section, a card, a screen) as Pixelwright\'s XML: Figma\'s layer types as tags, ids to read or change a layer later; a hidden layer is a stub with display="none". The first text block is the XML; the second is JSON with node (the layer read) and truncated (ids of layers whose children were not all read, $children="N" in the XML: read each on its own). For a big frame, find its sections with outline first.',
} as const;

export const DESIGN_READ_FIELD = {
  node: "The layer's id, e.g. 54:243. Default: the one layer selected in Figma.",
  depth: "Levels below the layer to read. Default: all.",
} as const;

/** What design_read says of a layer it does not read. */
export const DESIGN_READ_TEXT = {
  hidden: (id: string) =>
    `${id} is hidden in Figma, and a hidden layer is read as a name and a box only: show it, or read a visible one.`,
} as const;
