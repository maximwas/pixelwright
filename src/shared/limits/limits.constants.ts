const MIB = 1024 * 1024;

/**
 * Every limit server and plugin share, once, each with its reason (P-155+r). test/golden/limits.golden.test.ts pins the
 * values: a change is a reviewed golden diff.
 */
export const LIMITS = {
  /** One bridge frame: a stdio MCP message breaks above 10 MiB, and a result travels the bridge and stdio both. */
  frameBytes: 4 * MIB,
  /** One export chunk: base64 makes it a third bigger, and it must fit a frame. */
  exportChunkBytes: 2 * MIB,
  /** One upload stream: four of the largest files a call sends fit the upload store. */
  uploadStreamBytes: 32 * MIB,
  /** Bytes of files waiting for their apply at once before the oldest go. */
  uploadStoreBytes: 128 * MIB,
  /** How long a file sent for an apply waits for it. */
  uploadTtlMs: 5 * 60 * 1000,
  /** The longest design_apply XML: a big page fits, a runaway generator does not. */
  applyXmlChars: 2_000_000,
  /** What one read may put in its answer, breadth first: under the frame cap with room for the envelope. */
  readJsonChars: 1_000_000,
  /** design_read's default maxChars: a section a model reads whole without crowding its context. */
  designReadChars: 80_000,
  /** The longest side of an image a tool returns inline: models read larger ones badly, some clients refuse them. */
  inlineImageSidePx: 2_000,
  /** The most bytes of an inline image: base64 grows it a third, model APIs refuse about 5 MB. */
  inlineImageBytes: 3.5 * MIB,
  /** Renders a screenshot tries, each at a lower scale, to fit the inline limits. */
  inlineImageAttempts: 3,
  /** A plugin request's timeout when the op names none. */
  requestTimeoutMs: 30_000,
  /** The longest timeout an op may ask for (version saves and big applies). */
  requestMaxTimeoutMs: 310_000,
  /** How long one op may walk a big file before it answers with what it has: under requestTimeoutMs. */
  opBudgetMs: 20_000,
  /** The most nodes one outline lists; children past it are counted, not listed. */
  outlineNodes: 2_000,
  /** The most layers viewport_get lists as in view. */
  viewportLayers: 50,
  /** The most prototype links flow_read lists. */
  flowLinks: 500,
  /** The most layers file_map lists in all; past it a page says how many it has. */
  fileMapNodes: 1_500,
  /** A frame or group with more layers than this is a design of its own, not a note. */
  noteLayers: 20,
  /** A note's text past this many characters is cut with an ellipsis. */
  noteTextChars: 2_000,
  /** How long the canvas around a screen is walked for notes, at most. */
  nearbyMs: 5_000,
  /** The longest a named version waits for Pixelwright's last write to settle, so the version holds it. */
  versionSettleMs: 5_000,
  /** Main components looked up at once for components_read. */
  mainComponentBatch: 25,
  /** Components whose Dev Mode links are asked for at once: each ask goes to Figma's servers. */
  devLinksBatch: 25,
  /** How close two colour channels count as the same: CSS shows a P3 file's channels to 4 decimals. */
  colorEpsilon: 0.0005,
} as const;
