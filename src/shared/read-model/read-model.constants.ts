/** The read model's header (A§7.1, D-05): its version, exact like the protocol's, and the numbers its fields keep. */
export const READ_MODEL = {
  version: 1,
  /** A mirrored layer's relative transform keeps its 2x2 part: a, b, c, d. */
  matrixEntries: 4,
  /** A style's number among those of its kind with its name: the first keeps the bare name, the next is --Name-2. */
  firstDuplicate: 2,
} as const;

/**
 * Who a read is for (A§7.1.2): each profile reads its own field groups. A baseline v1 snapshot, which has no header, is
 * a design read.
 */
export const READ_PROFILE = { design: "design", apply: "apply", inspect: "inspect", checks: "checks" } as const;

/**
 * The fields Figma's own variable match (inferredVariables) is read for (C-153), and what a hint calls each. Width and
 * height are not among them: Figma matches a text's height to a spacing token.
 */
export const INFERRED_WORDS: Readonly<Record<string, string>> = {
  itemSpacing: "gap",
  counterAxisSpacing: "gap",
  paddingLeft: "padding",
  paddingRight: "padding",
  paddingTop: "padding",
  paddingBottom: "padding",
  cornerRadius: "border-radius",
  topLeftRadius: "border-radius",
  topRightRadius: "border-radius",
  bottomLeftRadius: "border-radius",
  bottomRightRadius: "border-radius",
  strokeWeight: "border-width",
  strokeTopWeight: "border-width",
  strokeRightWeight: "border-width",
  strokeBottomWeight: "border-width",
  strokeLeftWeight: "border-width",
  gridRowGap: "row-gap",
  gridColumnGap: "column-gap",
  opacity: "opacity",
};

/** Fields bound as one: when a variable is bound to any of them, Figma's match for the others says nothing new. */
export const INFERRED_GROUPS: readonly (readonly string[])[] = [
  ["cornerRadius", "topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"],
  ["strokeWeight", "strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"],
];

/** Values the plugin sends in place of Figma's own. */
export const READ_VALUE = {
  /** Figma's `figma.mixed`: a property that differs across a node's parts. */
  mixed: "mixed",
  /** A text decoration drawn in the text's own colour. */
  autoColor: "AUTO",
} as const;

/** A component property's key as Figma gives it, "Name#12:0" (a variant's has no #id), and its name as people see it. */
export const PROPERTY_KEY = {
  separator: "#",
  name: (key: string) => key.split(PROPERTY_KEY.separator)[0] ?? key,
} as const;
