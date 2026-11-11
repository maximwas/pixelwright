/**
 * The inspect op's bounds (T-080): a hundred layers a call, so one answer stays under the bridge's frame cap (O-014);
 * the ids of the layers a subtree read left are listed up to 500; a subtree walk looks at 20 000 layers at most, a
 * property check each, so a huge page cannot hold the plugin.
 */
export const INSPECT = { maxLayers: 100, maxLeftIds: 500, maxScan: 20_000 } as const;

/** The groups of an inspected layer `fields` keeps (RG-3); a subtree read lists the layers that carry one. */
export const INSPECT_GROUP = {
  box: "box",
  parent: "parent",
  path: "path",
  fills: "fills",
  strokes: "strokes",
  effects: "effects",
  layout: "layout",
  bound: "bound",
  text: "text",
  component: "component",
  interactions: "interactions",
} as const;

/** The layout fields of a parent that places a layer, read beside the layer (RG-3). */
export const INSPECT_PARENT_LAYOUT_KEYS = [
  "layoutMode",
  "layoutWrap",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "counterAxisAlignContent",
  "itemSpacing",
  "counterAxisSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gridRowCount",
  "gridColumnCount",
  "gridRowGap",
  "gridColumnGap",
  "gridRowSizes",
  "gridColumnSizes",
] as const;
