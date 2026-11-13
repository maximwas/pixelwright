/** design_apply as clients list it. */
export const DESIGN_APPLY_TOOL = {
  name: "design_apply",
  title: "Write a design",
  description:
    "Writes Pixelwright XML, the format design_read returns, into Figma: changes layers by id and creates them (Frame, Section, Text, TextPath, Rectangle, Ellipse, Line, Image, Icon, Component, ComponentSet, Instance, Slot, and a Page). It writes names, visibility, auto layout and grids, sizes, places and rotation, moves and copies, opacity, clipping, fills and gradients, borders, radii, shadows and blurs, blend modes and masks, colour tokens and styles, images and icons from files, text with its fonts, Spans and links, text on a path, variable modes, Dev Mode notes, instances (component, variant, props), component properties, variant sets and slots. Read guide write before the first call (Allow edits, dryRun, version, errors and every rule), and guide layout for flex, grid and absolute placement.",
} as const;

const MIB = 1024 * 1024;

/** The files design_apply writes from (T-131), with 0.7.0's numbers. */
export const SOURCE_LIMIT = {
  /** MAX_SVG_BYTES: an icon's SVG travels inline on its change, in one frame. */
  svgBytes: 2 * MIB,
  /** MAX_FIGMA_IMAGE_SIDE: createImage refuses past it, verified live (4100 refused, FX-055). */
  imageSide: 4096,
  /** An SVG names its root this early: past it the file is no SVG. */
  svgSniffBytes: 4096,
} as const;

/** The formats image-size names that an image file may be, and those Figma makes images of (FX-055). */
export const SOURCE_FORMAT = { known: ["png", "jpg", "gif", "webp"], figma: ["png", "jpg", "gif"] } as const;

export const SOURCE_KIND = { image: "image", icon: "icon" } as const;

export const SOURCE_PROBLEM = { missing: "missing", unusable: "unusable" } as const;

export const SOURCE_VALUE = {
  hash: "sha1",
  hex: "hex",
  utf8: "utf8",
  /** The number design_read adds to a file name taken earlier in the same read, before the extension. */
  numbered: /-\d+(\.[^./\\]+)$/,
  unnumbered: "$1",
  svg: /<svg[\s>]/i,
} as const;

export const SOURCE_TEXT = {
  key: (kind: string, path: string) => `${kind} ${path}`,
  notAFile: (path: string, folder: string | null) =>
    folder === null
      ? `${path} is not a file the server can read.`
      : `${path} is not a file the server can read (relative paths are from the project folder: ${folder}).`,
  tooBig: (
    path: string,
    bytes: number,
    kind: string,
    limit: number,
  ) =>
    `${path} is ${Math.round(bytes / MIB)} MB: design_apply takes ${kind === SOURCE_KIND.icon ? "an SVG" : "an image"} of ${limit / MIB} MB at most.`,
  notSvg: (path: string) => `${path} is not an SVG: an <Icon> is drawn from an SVG file.`,
  notImage: (path: string) => `${path} is not a PNG, JPG, GIF or WebP image.`,
  webp: (path: string) =>
    `${path} is a WebP image: Figma makes images of PNG, JPG and GIF files only, so convert it first.`,
  tooWide: (
    path: string,
    width: number,
    height: number,
  ) =>
    `${path} is ${width}×${height} px: Figma takes images up to ${SOURCE_LIMIT.imageSide} px a side, so scale it down first.`,
  redraw: (path: string) =>
    `${path} would redraw the icon: an icon's SVG makes new vector layers, so delete the icon and create it again from the file.`,
} as const;

/** Why 2,000,000: 0.7.0 took that much XML in one call, about 20,000 lines. */
export const DESIGN_APPLY_LIMIT = { xmlChars: 2_000_000 } as const;

/** What FontRanges logs: a call over the cap of families checks their axes' tags alone. */
export const FONT_RANGES_LOG = {
  skipped: "font-variation-settings go over more families than the cap: their axes are checked by tag alone",
} as const;

/** The family Figma starts a new text in (FX-040), whose axis ranges a new text's font-variation-settings need. */
export const NEW_TEXT_FAMILY = "Inter";

export const DESIGN_APPLY_FIELD = {
  xml: "Pixelwright XML, as design_read writes it: an element with id changes that layer (only the attributes it gives), one without id creates a layer.",
  elements:
    "The elements read, in document order: line and column, tag, id (null for a new layer), ref (new:<line> for a new one), parent ref, index among its siblings, the attributes kept, a Text's content pieces, and for an element inside a copy its source and copy; notWritten lists the attributes no writer handles yet (left out of changes, not refused).",
  errors:
    "Every refusal, in document order: line and column, the id and attribute it concerns, the message and a hint. An element that is refused is not in elements; an attribute that is refused is left out of it.",
  parent:
    "Where top-level new layers go: a frame's, section's or page's id. Default: the current page, beside its layers.",
  created:
    "The layers made, by their element's line and ref, with their ids and names; a dry run's, which it would make, have neither.",
  changed: "The ids of the existing layers written to (a dry run's: would be).",
  properties:
    "The properties prop, visibleProp and swapProp added to components that were there before the call (a dry run's: would add), each on its component or set by id, by name without Figma's #id; left out when none.",
  changes:
    "What the call would make or change, in document order, in Figma's terms: kind (create or update), id, tag, props (only what the layer does not have yet) and sources (the attribute each prop came from). A layer that already looks as written is not listed.",
} as const;
