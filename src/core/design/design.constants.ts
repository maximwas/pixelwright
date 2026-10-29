/** The node types that carry a text (K-083): a text, and a text on a path. Their element holds the characters. */
export const TEXT_TYPES = { TEXT: "TEXT", TEXT_PATH: "TEXT_PATH" } as const;

/** The node types design_read leaves out, visible or not: they draw nothing (C-141). */
export const INVISIBLE_TYPES = { SLICE: "SLICE" } as const;

/**
 * A layer element's attributes, in the order it writes them (C-1.3): what the layer is (metadata), its CSS (from
 * `display`), then the read-only `$` attributes design_apply leaves alone, `$children`, `$truncated` and `$repeat` last.
 */
export const DESIGN_ATTRIBUTE = {
  id: "id",
  name: "name",
  component: "component",
  variant: "variant",
  props: "props",
  exposed: "$exposed",
  description: "description",
  note: "note",
  /** The properties a designer pinned in Dev Mode annotations, in CSS words (C-1.5); read-only. */
  pins: "$pins",
  /** What an instance changed on the layer outside its component's properties, in CSS words (C-133). */
  override: "$override",
  dev: "$dev",
  href: "href",
  textStyle: "textStyle",
  /** An asset's planned file (C-144). */
  src: "src",
  mask: "mask",
  /** A text on a path's path, and where on it its text starts (T-140). */
  d: "d",
  start: "start",
  display: "display",
  prop: "$prop",
  visibleProp: "$visibleProp",
  swapProp: "$swapProp",
  /** The CSS design_apply cannot write back (a negative gap, ...), as `property: value; ...`. */
  css: "$css",
  gridStyle: "$grid-style",
  /** How many children a layer has when the read did not list them all: read that layer on its own. */
  children: "$children",
  /** A branch emptied or a text shortened to fit maxChars (T-054): read that layer on its own. */
  truncated: "$truncated",
  /** How many alike neighbours a run's first stands for (T-059). */
  repeat: "$repeat",
} as const;

/** The value of a flag attribute such as `$truncated`. */
export const DESIGN_FLAG = { on: "true" } as const;
