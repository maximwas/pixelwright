/** Paints and effects core writes as CSS itself; anything else asks Figma for its CSS in "unmapped" mode. */
export const MAPPED_PAINTS: ReadonlySet<string> = new Set(["SOLID", "IMAGE"]);
export const MAPPED_EFFECTS: ReadonlySet<string> = new Set([
  "DROP_SHADOW",
  "INNER_SHADOW",
  "LAYER_BLUR",
  "BACKGROUND_BLUR",
]);

/** An auto layout frame's own fields. */
export const AUTO_LAYOUT_FIELDS = [
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
  "itemReverseZIndex",
  "strokesIncludedInLayout",
] as const;

/** A grid frame's own fields; its track sizes are lists. */
export const GRID_FIELDS = [
  "gridRowCount",
  "gridColumnCount",
  "gridRowGap",
  "gridColumnGap",
  "gridRowSizes",
  "gridColumnSizes",
] as const;

/** A grid's child's place in it. */
export const GRID_CHILD_FIELDS = [
  "gridRowAnchorIndex",
  "gridColumnAnchorIndex",
  "gridRowSpan",
  "gridColumnSpan",
  "gridChildHorizontalAlign",
  "gridChildVerticalAlign",
] as const;

/** The sizes an auto layout child may be held between. */
export const SIZE_LIMIT_FIELDS = ["minWidth", "maxWidth", "minHeight", "maxHeight"] as const;

/** A stroke's weight per side, when the sides differ. */
export const STROKE_SIDE_FIELDS = [
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
] as const;

/** A radius per corner, when the corners differ. */
export const CORNER_FIELDS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

/** The styles a layer may use, by kind. */
export const STYLE_ID_FIELDS = ["fillStyleId", "strokeStyleId", "effectStyleId", "textStyleId", "gridStyleId"] as const;

export type SegmentField = keyof Omit<StyledTextSegment, "characters" | "start" | "end">;

export const BASE_SEGMENT_FIELDS: SegmentField[] = [
  "fontName",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textDecoration",
  "textCase",
  "lineHeight",
  "letterSpacing",
  "fills",
  "fillStyleId",
  "textStyleId",
  "hyperlink",
  "boundVariables",
];

/** Newer fields (text wrap: Aug 2026): a Figma without them refuses the whole call, so they are asked for apart. */
export const SEGMENT_FIELDS: SegmentField[] = [
  ...BASE_SEGMENT_FIELDS,
  "textDecorationStyle",
  "textDecorationOffset",
  "textDecorationThickness",
  "textDecorationColor",
  "listOptions",
  "indentation",
  "paragraphIndent",
  "paragraphSpacing",
  "textWrapStyle",
  "openTypeFeatures",
];
