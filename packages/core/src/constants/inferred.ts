/**
 * The fields Figma's own variable match (inferredVariables) is read for, and what a hint calls each. Width and height
 * are not among them: Figma matches a text's height to a spacing token.
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
