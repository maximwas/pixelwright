import { ASSET_TAG } from "@/core/design/assets/assets.constants.ts";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";

/** nodes_diff's words (T-085, K-051): a root's path, how a path's steps join, a text's own characters, a span's tag. */
export const DIFF = {
  root: "(root)",
  joiner: " / ",
  text: "$text",
  span: "Span",
  /** The most entries each list of an answer holds (0.7.0's MAX_DIFF_ENTRIES): `more` counts the rest. */
  maxEntries: 200,
} as const;

/** What names a root or says where it is: two variants side by side differ there by nature (src follows the name). */
export const ROOT_PLACEMENT = [
  DESIGN_ATTRIBUTE.name,
  DESIGN_ATTRIBUTE.src,
  "position",
  "left",
  "top",
  "right",
  "bottom",
  "transform",
] as const;

/** Tags whose look is a file of its own: compared by what draws them too. */
export const DRAWN_TAGS = [ASSET_TAG.icon, ASSET_TAG.image] as const;

/**
 * Read-model fields that name or place a layer, or say what it does, rather than draw it (K-052): its notes and
 * description, its link and prototype, its animation, its export settings, Figma's own matches and overrides.
 */
export const NOT_DRAWING = [
  "id",
  "name",
  "x",
  "y",
  "bounds",
  "renderBounds",
  "css",
  "description",
  "annotations",
  "href",
  "reactions",
  "motion",
  "exportSettings",
  "inferred",
  "overrides",
] as const;

export const DIFF_TEXT = {
  label: (
    tag: string,
    name: string,
    index: number,
  ) => `${tag} "${name}"${index > 0 ? `[${index + 1}]` : ""}`,
  key: (tag: string, name: string) => `${tag} ${name}`,
  noElement: (id: string) => `${id} draws nothing design_read writes: compare the layers in it.`,
  noVariants: (name: string) => `${name} has no variants.`,
} as const;

/** variants_read's bounds (K-053): the variants one answer compares, the differences listed per list. */
export const VARIANTS = { max: 50, diffMax: 100, componentType: "COMPONENT" } as const;

/** State values and the CSS pseudo-class each suggests (T-086). */
export const STATE_PSEUDO = [
  { pattern: /^hover(ed)?$/i, pseudo: ":hover" },
  { pattern: /^(pressed|active|down)$/i, pseudo: ":active" },
  { pattern: /^focus(ed)?$/i, pseudo: ":focus-visible" },
  { pattern: /^disabled$/i, pseudo: ":disabled" },
] as const;

/** Words and numbers that name a size, not a screen: Desktop, Mobile, 1440, 375px, 1440×900. */
export const SIZE_WORDS =
  /\b(desktop|tablet|mobile|phone|laptop|web|ipad|iphone|android|wide|small|medium|large|xl|lg|md|sm|xs|\d{3,4}(\s*[x×]\s*\d{3,4})?(px)?)\b/gi;

/** What splits a screen's name into words. */
export const WORD_BREAK = /[^\p{L}\p{N}]+/u;

/** How breakpoints_find scores a screen (K-054): weights as data, a heuristic not yet held against many files. */
export const BREAKPOINTS = {
  /** A name's words count for this much of a score, the children's names for the rest. */
  names: 0.6,
  children: 0.4,
  /** The least a screen must score to count as the same one at another width. */
  sameScreen: 0.5,
  /** Widths this close are one breakpoint: another frame there is a state of the screen, not a size. */
  sameWidth: 8,
  scorePlaces: 2,
  space: " ",
} as const;

export const BREAKPOINTS_TEXT = {
  none: (name: string) => `No other screen on the page looks like ${name} at another width.`,
  found: (name: string, widths: readonly number[]) =>
    `${name} at ${widths.map((width) => `${width}px`).join(", ")}: compare them with nodes_diff for the media queries.`,
} as const;

/** The answers' field descriptions, as tools.json pins them. */
export const DIFF_FIELD = {
  drawing: "An icon's or image's own drawing differs: paths, colours, inner layers.",
  properties: "Each variant property with its values.",
  default: "The default variant: the top-left one, as Figma takes it.",
  against:
    "The variant it is compared with: the one it differs from by a single property (a state first), else the default.",
  pseudo: "The CSS pseudo-class a state value suggests: :hover, :active, :focus-visible, :disabled.",
  changed: "Attributes as [the default's, this variant's].",
  more: "Variants left out: read a smaller set, or the variants one by one.",
  score: "How alike the two are, 0 to 1: names without size words, and shared children.",
  this: "The screen asked about.",
  widths: "The screen at each width, narrowest first.",
} as const;
