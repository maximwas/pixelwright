/** design_read as clients list it (tools.json pins every word): 0.7.0's words for what this build reads. */
export const DESIGN_READ_TOOL = {
  name: "design_read",
  title: "Read a design",
  description:
    'Reads a layer (a section, a card, a screen) as Pixelwright\'s XML: Figma\'s layer types as tags, ids to read or change a layer later; a hidden layer is a stub with display="none". The first text block is the XML; the second is JSON with node (the layer read), tokens, textStyles, fonts, assets and truncated (ids of layers the read cut: $children="N" where not all children were read, $truncated="true" where a branch or a text was cut to fit maxChars: read each on its own); with repeats, runs of three or more alike neighbours read as their first with $repeat="N", and JSON repeats holds each one\'s own values as rows. For a big frame, find its sections with outline first.',
} as const;

export const DESIGN_READ_FIELD = {
  node: "The layer's id, e.g. 54:243. Default: the one layer selected in Figma.",
  depth: "Levels below the layer to read. Default: all.",
  maxChars:
    "The most characters of XML: past it the deepest branches, then long lists, then long texts are cut. Default: 80000.",
  repeats: "Read each run of three or more alike neighbours as its first, with $repeat and JSON rows. Default: false.",
} as const;

/** maxChars' range, as 0.7.0 (T-050): under 2,000 no section reads usefully; 400,000 is far past any client's text block. */
export const DESIGN_READ_LIMITS = { minChars: 2_000, maxChars: 400_000 } as const;

/** What design_read says of a layer it does not read. */
export const DESIGN_READ_TEXT = {
  hidden: (id: string) =>
    `${id} is hidden in Figma, and a hidden layer is read as a name and a box only: show it, or read a visible one.`,
} as const;
