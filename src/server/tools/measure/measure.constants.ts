/** measure as clients list it (tools.json pins every word), 0.7.0's words. */
export const MEASURE_TOOL = {
  name: "measure",
  title: "Measure between layers",
  description:
    "Measures the distances between layers, each from the one before it in the list (a→b, b→c, so a row's rhythm shows): the gap between their boxes on each axis (negative where they overlap), how their edges and centres line up (B's minus A's: 0 is aligned), and, when one holds the other, how far it sits from each edge, as padding. Layout boxes by default; painted: true measures what is painted (strokes, shadows). A sentence per pair says it plainly. Works while Allow edits is off.",
} as const;

export const MEASURE_INPUT = {
  nodes:
    'The layers\' ids in the order to measure, each from the one before, e.g. ["54:244", "54:268"]. Default: the layers selected in Figma.',
  painted: "Measure what is painted (centred or outside strokes, shadows, blur) instead of the layout boxes.",
} as const;

/** A pair takes two layers. */
export const MEASURE = { minLayers: 2 } as const;

export const MEASURE_TOOL_TEXT = {
  tooFew: (found: number, ids: readonly string[]) =>
    `Measuring takes two layers or more: ${found === 0 ? "none" : "only one"} of ${ids.length === 0 ? "the selection" : ids.join(", ")} ${found === 1 ? "is a layer" : "are layers"} of this file.`,
} as const;
