/** node_show's bounds both sides read (T-032, P-112), as 0.7.0 took them. */
export const SHOW = {
  /** Fit the layers in view: Figma's own scrollAndZoomIntoView picks the zoom. */
  fit: "fit",
  /** The most layers one call shows: they share one page and one view. */
  maxNodes: 50,
  /** 1% to 25 600%: Figma keeps the zoom inside its own range. */
  minZoom: 0.01,
  maxZoom: 256,
  /** A layer id's longest: an id inside nested instances grows with each level (I1:2;3:4;...). */
  idChars: 200,
} as const;
