import type { SnapshotNode, SnapshotPaint, SnapshotStyle, SnapshotVariable } from "./snapshot.ts";

/** The colour space a file's colours are in: Figma's sRGB (or LEGACY) documents, or Display P3 ones. */
export type ColorSpace = "srgb" | "display-p3";

export interface CssContext {
  readonly styles: Readonly<Record<string, SnapshotStyle>>;
  readonly variables: Readonly<Record<string, SnapshotVariable>>;
  /** Every token the CSS refers to, with its value, gathered as layers are written: `--color-ink` → `#14161F`. */
  readonly tokens: Map<string, string>;
  /** The layer the read starts from: it always gets its size, whatever its sizing. */
  readonly root: SnapshotNode;
  /** The URL an image fill is written with; the asset plan names the files. */
  readonly imageUrl?: ((node: SnapshotNode, paint: SnapshotPaint) => string) | undefined;
  /** The file's colour space: a Display P3 file's colours are written as color(display-p3 …). */
  readonly colorSpace?: ColorSpace;
}

/** A layer's CSS: what design_apply can write back, and what it cannot yet (read-only, from getCSSAsync). */
export interface NodeCss {
  readonly properties: [string, string][];
  readonly readOnly: [string, string][];
  /** The text style the layer uses: its properties hold only what differs from it. */
  readonly textStyle?: string;
}
