/** design_read as clients list it (tools.json pins every word): 0.7.0's words for what this build reads. */
export const DESIGN_READ_TOOL = {
  name: "design_read",
  title: "Read a design",
  description:
    'Reads a layer (a section, a card, a screen) as Pixelwright\'s XML: Figma\'s layer types as tags, ids to read or change a layer later; a hidden layer is a stub with display="none". The first text block is the XML; the second is JSON with node (the layer read), tokens, textStyles, fonts, assets, measurements (the designer\'s Dev Mode measurements, when there are any), hints (what the code should know or fix, one per kind with a count and examples) and truncated (ids of layers the read cut: $children="N" where not all children were read, $truncated="true" where a branch or a text was cut to fit maxChars: read each on its own); with repeats, runs of three or more alike neighbours read as their first with $repeat="N", and JSON repeats holds each one\'s own values as rows; with nearby, JSON nearby lists the designer\'s notes around the screen. For a big frame, find its sections with outline first.',
} as const;

export const DESIGN_READ_FIELD = {
  node: "The layer's id, e.g. 54:243. Default: the one layer selected in Figma.",
  depth: "Levels below the layer to read. Default: all.",
  screenshot: "Also return the layer's image, to compare your build with.",
  maxChars:
    "The most characters of XML: past it the deepest branches, then long lists, then long texts are cut. Default: 80000.",
  repeats: "Read each run of three or more alike neighbours as its first, with $repeat and JSON rows. Default: false.",
  autoLineHeight:
    "How to write Figma's Auto line height: normal (default), or px, the px Figma renders it at where the read can tell (a text that hugs its lines shows it for its font and size), normal elsewhere. A px read sent back to design_apply fixes those line heights at that px.",
  nearby:
    "Also list the designer's notes on the canvas within this many px of the screen holding the layer (texts, stickies, small frames of text beside it or over it), e.g. 400: the JSON's nearby.",
} as const;

/** How design_read writes Figma's Auto line height (T-060). */
export const DESIGN_READ_LINE_HEIGHT = { normal: "normal", px: "px" } as const;

/** maxChars' range, as 0.7.0 (T-050): under 2,000 no section reads usefully; 400,000 is far past any client's text block. */
export const DESIGN_READ_LIMITS = { minChars: 2_000, maxChars: 400_000 } as const;

/** What design_read says of a layer it does not read. */
export const DESIGN_READ_TEXT = {
  hidden: (id: string) =>
    `${id} is hidden in Figma, and a hidden layer is read as a name and a box only: show it, or read a visible one.`,
  /** A plugin of an earlier release does not know the nearby op: the server updates on its own, the plugin does not. */
  oldPlugin:
    "The Pixelwright plugin in this file is older than the server and cannot read the notes around a screen: run npx -y pixelwright@latest to update it, or read without nearby.",
} as const;

/** design_read's image (T-056): the layer at scale 1 with its effects, as the screenshot tool renders it. */
export const DESIGN_READ_SHOT = { scale: 1, effects: true } as const;
