/**
 * How many decimals each class of value keeps when read (D-15, A§7.4): the one table every formatter reads, so readers
 * stop disagreeing (O-026). A value it does not name keeps 0.7.0's rule; the Orbit goldens decide a disagreement (D-21).
 */
export const PRECISION = {
  /** Boxes (left, top, width, height, min and max sizes), whole px: a layout's fractions (166.047px) are noise (C-010). */
  box: 0,
  /** Gaps, padding and radii, whole px like the boxes they sit in. */
  spacing: 0,
  /** Border and outline weight: a 2.5 border draws 2.5 px, and rounding it wrote 3px (C-012, B-037). */
  stroke: 2,
  /** Blur, as CSS's 0.43 R: a fraction of a blur shows (C-012, C-100). */
  blur: 2,
  /** Letter spacing and line heights in px, Auto px included: a fraction moves every line after it (T-060). */
  textSpacing: 2,
  /** Opacity, percents, em: 0.07em is 7.000000000000001% before rounding (C-011). */
  decimal: 2,
  /** rgba alpha: Figma's opacity field takes whole percents, which two decimals hold (C-1.7). */
  alpha: 2,
  /** display-p3 channels: CSS shows a P3 file's channels to 4 decimals (C-1.7). */
  p3Channel: 4,
  /** cubic-bezier points: 3 decimals hold Figma's easing curves (K-066). */
  bezier: 3,
  /** Inspect angles, rounded after the modulo (T-082). */
  angle: 2,
  /** Read model boxes, as 0.7.0's snapshot kept them: baselines v1 and the Orbit fixtures hold 2 decimals (K-084). */
  layer: 2,
  /** A mirrored layer's 2x2 matrix in the read model, 0.7.0's 4 decimals: a flip's sign and its scale both show. */
  matrix: 4,
} as const;
