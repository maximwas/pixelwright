/** styles_compare as clients list it (tools.json pins every word): 0.7.0's words, with 0.8.0's reading of a layer. */
export const STYLES_COMPARE_TOOL = {
  name: "styles_compare",
  title: "Compare a build's styles with the design",
  description:
    "Whether a build has each style the design sets, property by property. Give pairs: a layer (design_read's id) and the computed styles of the element that draws it, as the browser gives them: Object.fromEntries([...getComputedStyle(el)].map((p) => [p, getComputedStyle(el).getPropertyValue(p)])), or only the properties a first call lists in notGiven. Each layer is read as design_read writes it: in its parent when another pair's layer holds it, else as a read of its own (its size, not its place); its tokens and text style in and its shorthands spread into longhands (padding into padding-top…, border into each side's width, style and colour, font into family, size, weight, style and line height, gap into row-gap and column-gap, the main axis's only in a flex that does not wrap). mismatches gives each property the build has otherwise with both values and the token or text style it comes from; notGiven what the build's styles leave out; notCompared what a computed style cannot be held against (offsets in percent or calc(), fr tracks). Sizes and places may be off by tolerance px; other lengths, colours (hex or rgb()), shadows, gradients and transforms compare by value. What the design leaves unset is not checked, nor a hidden layer. Layers with differences come first. image_compare compares the pixels. Works while Allow edits is off.",
} as const;

export const STYLES_COMPARE = {
  /** Pairs one call compares: a screen's elements, not a whole site. */
  pairsMax: 100,
  /** Computed properties one pair may give: a whole getComputedStyle holds 400 to 600. */
  propertiesMax: 1_000,
  /** How far a size or a place may be off by default, in px: layout rounds them. */
  tolerance: 1,
  /** Past this a tolerance hides real differences. */
  toleranceMax: 20,
  nodeChars: 200,
  keyChars: 100,
  valueChars: 4_000,
  labelChars: 200,
} as const;

export const STYLES_COMPARE_FIELD = {
  node: "The layer, by the id design_read gives it, e.g. 54:243.",
  css: "The computed styles of the element that draws the layer in the build, by property: getComputedStyle's values, background-color or backgroundColor.",
  label: "What draws it in the build (a selector, a component), to tell the results apart.",
  pairs: "Each layer with the build's computed styles for it.",
  tolerance:
    "How far a size or a place may be off, in px (1 by default): layout rounds them. Other lengths, colours and numbers compare as CSS computes them.",
} as const;

export const STYLES_COMPARE_TEXT = {
  tooMany: `css holds at most ${STYLES_COMPARE.propertiesMax} properties.`,
} as const;
