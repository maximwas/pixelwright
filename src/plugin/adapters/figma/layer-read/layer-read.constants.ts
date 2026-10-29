/** How the layer readers tell a value from noise. */
export const LAYER_READ = {
  /** A layer draws past its box when its render bounds reach over half a pixel past it: less is rounding (0.7.0). */
  drawnPastPx: 0.5,
} as const;
