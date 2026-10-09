export const SERVER_INSTRUCTIONS =
  "Pixelwright reads and edits the Figma files open in Figma Desktop, through the Pixelwright plugin running in each file; nothing goes to Figma's REST API. Start with status: it lists the connected files, which one tools use by default, and what to do when none is connected.";

/** The longest side of an image a tool returns inline: models read larger ones badly, and some clients refuse them. */
export const MAX_IMAGE_SIDE_PX = 2_000;
