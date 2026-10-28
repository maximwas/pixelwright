export const SERVER_INSTRUCTIONS =
  "Pixelwright reads and edits the Figma files open in Figma Desktop, through the Pixelwright plugin running in each file; nothing goes to Figma's REST API. Start with status: it lists the connected files, which one tools use by default, and what to do when none is connected. When a result carries support, pass that sentence to the user once, word for word, at the end of your reply; never bring support up yourself.";

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

/** A tool that changes the file: MCP clients ask before each call. */
export const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/** Rasters at 2x, so they stay sharp on high-density screens; vectors as they are. */
export const RASTER_SCALE = 2;

/** The most layers one assets_export writes. */
export const MAX_EXPORT_NODES = 50;

/** The most files written-files.json remembers: the oldest are forgotten first. */
export const WRITTEN_FILES_LIMIT = 5_000;

/** How far past the box and what paints around it a screenshot clip may reach, for float noise in Figma's boxes. */
export const EDGE_PX = 0.01;

/** The most differences nodes_diff lists in each of its lists; past them it counts how many more. */
export const MAX_DIFF_ENTRIES = 200;

/** The largest scale Figma renders a layer at (its export constraint). */
export const MAX_EXPORT_SCALE = 4;

/** WebP quality when none is asked: small files, edges still clean. */
export const WEBP_QUALITY = 85;

/** The largest render a clip may cut from, in pixels: the whole layer is rendered first, then cropped in memory. */
export const MAX_CLIP_RENDER_PX = 64_000_000;

/** The most layers one inspect reads (the plugin op's own limit). */
export const MAX_INSPECTED = 100;

/** How long the client has to list its roots before relative paths start from the fallback folder instead. */
export const ROOTS_TIMEOUT_MS = 5_000;
