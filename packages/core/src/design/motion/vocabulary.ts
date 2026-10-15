/** The CSS property a Figma Motion field animates on its own, and whether its values are lengths. */
export const MOTION_PROPERTIES: Readonly<Record<string, { readonly property: string; readonly length: boolean }>> = {
  OPACITY: {
    property: "opacity",
    length: false,
  },
  WIDTH: {
    property: "width",
    length: true,
  },
  HEIGHT: {
    property: "height",
    length: true,
  },
  CORNER_RADIUS: {
    property: "border-radius",
    length: true,
  },
  RECTANGLE_TOP_LEFT_CORNER_RADIUS: {
    property: "border-top-left-radius",
    length: true,
  },
  RECTANGLE_TOP_RIGHT_CORNER_RADIUS: {
    property: "border-top-right-radius",
    length: true,
  },
  RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS: {
    property: "border-bottom-left-radius",
    length: true,
  },
  RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS: {
    property: "border-bottom-right-radius",
    length: true,
  },
  STROKE_WEIGHT: {
    property: "border-width",
    length: true,
  },
  BORDER_TOP_WEIGHT: {
    property: "border-top-width",
    length: true,
  },
  BORDER_RIGHT_WEIGHT: {
    property: "border-right-width",
    length: true,
  },
  BORDER_BOTTOM_WEIGHT: {
    property: "border-bottom-width",
    length: true,
  },
  BORDER_LEFT_WEIGHT: {
    property: "border-left-width",
    length: true,
  },
  STACK_SPACING: {
    property: "gap",
    length: true,
  },
  STACK_COUNTER_SPACING: {
    property: "row-gap",
    length: true,
  },
  STACK_PADDING_TOP: {
    property: "padding-top",
    length: true,
  },
  STACK_PADDING_RIGHT: {
    property: "padding-right",
    length: true,
  },
  STACK_PADDING_BOTTOM: {
    property: "padding-bottom",
    length: true,
  },
  STACK_PADDING_LEFT: {
    property: "padding-left",
    length: true,
  },
  GRID_ROW_GAP: {
    property: "row-gap",
    length: true,
  },
  GRID_COLUMN_GAP: {
    property: "column-gap",
    length: true,
  },
};

/**
 * The fields CSS animates as one property of two axes, translate and scale, with the value an axis has when no track
 * moves it; and rotation, whose sign CSS turns the other way.
 */
export const MOTION_AXES: Readonly<
  Record<string, { readonly property: "translate" | "scale"; readonly axis: "x" | "y" | "xy" }>
> = {
  TRANSLATION_X: {
    property: "translate",
    axis: "x",
  },
  TRANSLATION_Y: {
    property: "translate",
    axis: "y",
  },
  TRANSLATION_XY: {
    property: "translate",
    axis: "xy",
  },
  SCALE_X: {
    property: "scale",
    axis: "x",
  },
  SCALE_Y: {
    property: "scale",
    axis: "y",
  },
  SCALE_XY: {
    property: "scale",
    axis: "xy",
  },
};

/** What a field is called in a $motion summary when its CSS property does not say it. */
export const MOTION_NAMES: Readonly<Record<string, string>> = {
  TRANSLATION_X: "translate-x",
  TRANSLATION_Y: "translate-y",
  TRANSLATION_XY: "translate",
  SCALE_X: "scale-x",
  SCALE_Y: "scale-y",
  SCALE_XY: "scale",
  ROTATION: "rotate",
};

/** How to get what CSS cannot animate as a property, said in a comment. */
export const MOTION_UNCOVERED: Readonly<Record<string, string>> = {
  PATH_TRIM_START: "draw the stroke with stroke-dasharray and stroke-dashoffset",
  PATH_TRIM_END: "draw the stroke with stroke-dasharray and stroke-dashoffset",
  effects: "animate box-shadow or filter by hand",
  TEXT_DATA: "change the text in code",
};

/** Figma's springs, named in words in a $motion summary (its CSS draws them with linear()). */
export const MOTION_SPRINGS: ReadonlySet<string> = new Set(["GENTLE", "QUICK", "BOUNCY", "SLOW", "CUSTOM_SPRING"]);
