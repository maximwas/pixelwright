export const SERVER_INSTRUCTIONS =
  "Pixelwright reads and edits the Figma files open in Figma Desktop, through the Pixelwright plugin running in each file; nothing goes to Figma's REST API. Start with status: it lists the connected files, which one tools use by default, and what to do when none is connected.";

/** The longest side of an image a tool returns inline: models read larger ones badly, and some clients refuse them. */
export const MAX_IMAGE_SIDE_PX = 2_000;

/**
 * The most bytes of an image returned inline: base64 makes it a third bigger, a stdio MCP message breaks above 10 MiB,
 * and model APIs refuse images of about 5 MB.
 */
export const MAX_INLINE_IMAGE_BYTES = 3.5 * 1024 * 1024;

/** How many renders screenshot tries, each at a lower scale, to fit the inline limits. */
export const INLINE_ATTEMPTS = 3;
