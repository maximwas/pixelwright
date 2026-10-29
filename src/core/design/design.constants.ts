/** The node types that carry a text (K-083): a text, and a text on a path. Their element holds the characters. */
export const TEXT_TYPES = { TEXT: "TEXT", TEXT_PATH: "TEXT_PATH" } as const;

/** The node types design_read leaves out, visible or not: they draw nothing (C-141). */
export const INVISIBLE_TYPES = { SLICE: "SLICE" } as const;

/**
 * A layer element's attributes, in the order it writes them (C-1.3): what the layer is (metadata), its CSS (from
 * `display`), then the read-only `$` attributes design_apply leaves alone, `$children` last.
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
  dev: "$dev",
  href: "href",
  mask: "mask",
  display: "display",
  prop: "$prop",
  visibleProp: "$visibleProp",
  swapProp: "$swapProp",
  gridStyle: "$grid-style",
  /** How many children a layer has when the read did not list them all: read that layer on its own. */
  children: "$children",
} as const;
