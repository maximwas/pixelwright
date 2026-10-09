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

/** Tools that only read: they change nothing in Figma (node_show moves only the view and the selection). */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** The most library variables tokens_read lists by name; the rest are counted. */
export const MAX_LIBRARY_VARIABLES = 500;

/** Rasters at 2x, so they stay sharp on high-density screens; vectors as they are. */
export const RASTER_SCALE = 2;

/** The most layers one assets_export writes. */
export const MAX_EXPORT_NODES = 50;
