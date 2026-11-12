/** inspect as clients list it (tools.json pins every word): 0.7.0's words, with blend modes, fills and bound tokens. */
export const INSPECT_TOOL = {
  name: "inspect",
  title: "Inspect layers",
  description:
    "Reads layers as Figma has them, for what design_read's CSS cannot say, without running code (works while Allow edits is off). Recipes: fills, strokes and bound variables of every layer under a card: within + fields [\"fills\",\"strokes\",\"bound\"]; a layer's and its parent's auto layout (padding, gap, direction): fields [\"layout\"] gives layout and parentLayout; a mixed text's runs: fields [\"text\"] gives segments; how far a layer overflows its parent, and its boxes: fields [\"box\"]; its ancestors by id and its page: fields [\"path\"]. An absent field is at its default (no padding-* keys is padding 0: with any side set, all four are listed, 0 included; no gap key means no gap shown, which includes a spread layout, one visible child or a negative gap; no flex-direction is row; no overflow is none, absolute-positioned layers excepted) and the answer is complete unless `more` is true or a note says the scan stopped. inspect does not say whether a layer is hidden: use nodes_find with visible: false. Also: the layout box and the painted box (centred or outside strokes, shadows and blur reach past it), the blend mode of the layer and of each fill, the fill as a CSS value with the paint style or variables behind it and every fill's type, the variables bound to its padding, gap, radius and size, how strokes paint (align, per-side weights, dashes, the variables their colours are bound to), every effect with Figma's own parameters, a text's lines with what ended each (Enter or Shift+Enter) and its line heights, its prototype interactions, its component's variant and every component property with its value and the component's default. within reads a whole subtree in one call (depth levels); nested instance ids such as I54:244;54:205;54:188 work as nodes. Boxes and each layer's centre are measured from relativeTo's top left, so it also measures: give a list of layers and their section. For layers set around a circle, around (the circle's id, or a point) adds each centre's distance from it and its angle as CSS rotate() turns (0 up, clockwise). Up to 100 layers a call: left counts the selected layers past them, more and leftIds a subtree's.",
} as const;

export const INSPECT_INPUT = {
  nodes: 'The layers\' ids, e.g. ["54:243"]. Default: the layers selected in Figma.',
  within:
    "Instead of nodes: this layer and every layer under it, in document order, at most 100 a call (more: true and leftIds when there are more). With fields, only the layers that carry one of those groups are listed and counted.",
  depth: "With within: how many levels below it to read (0: the layer alone). Default: all.",
  fields:
    'Only these groups of each layer, besides id, name and type (without fields every group comes): box, parent, path, fills, strokes, effects, layout, bound, text, component, interactions. With within, only the layers that carry one are listed: fields ["layout"] lists the auto layout and grid frames of a subtree. layout also gives parentLayout (the parent layout), text gives segments (the runs of a mixed text), box gives center, paintedBox, rotation and overflow, path gives page. box (with center) and parent come only when asked: fields ["layout", "box"]. fills, strokes and bound name each bound variable by token and by its Figma name (variable).',
  relativeTo: "A layer (a section, a frame) whose top left the boxes are measured from. Default: the page's.",
  around:
    "A point to measure each layer's distance and angle from: a layer's id (its centre, e.g. a ring's), or {x, y} in the boxes' origin (relativeTo's top left, or the page's). The angle matches CSS rotate(): 0 straight up, then clockwise to 360.",
} as const;

export const INSPECT_TOOL_TEXT = {
  nothingSelected: "Nothing is selected in Figma: select the layers to inspect, or give their ids in nodes.",
  oneOf: "Give exactly one of nodes and within.",
  aroundMissing: (id: string) => `around: ${id} is not a layer of this file.`,
} as const;
