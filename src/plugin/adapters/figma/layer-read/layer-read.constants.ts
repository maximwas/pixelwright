/** How the layer readers tell a value from noise. */
export const LAYER_READ = {
  /** A layer draws past its box when its render bounds reach over half a pixel past it: less is rounding (0.7.0). */
  drawnPastPx: 0.5,
} as const;

/** Figma's defaults the appearance reader leaves out. */
export const APPEARANCE_FIELD = {
  opaque: 1,
  /** A frame passes through, a shape is normal: both blend as nothing. */
  plainBlends: ["PASS_THROUGH", "NORMAL"],
  /** The constraint pinned to the start, Figma's default on both axes. */
  start: "MIN",
} as const;

/** Figma's layout values the layout reader tells apart: no layout, a grid, and the defaults it leaves out. */
export const LAYOUT_FIELD = { noLayout: "NONE", grid: "GRID", flowing: "AUTO", inherit: "INHERIT" } as const;
