/** A file design_read plans to write: an icon as SVG, an image as PNG (or the designer's own export settings). */
export interface PlannedAsset {
  readonly node: string;
  readonly kind: "icon" | "image";
  readonly format: string;
  /** The path the XML refers to, relative to where the code will live: `assets/icon.svg`. */
  readonly src: string;
  readonly scale?: number;
  /** For an image fill behind content: the original image, fetched by its hash instead of a render. */
  readonly imageHash?: string;
}

export interface DesignRead {
  readonly xml: string;
  /** Every token the XML refers to: `--color-ink` → `#14161F`. */
  readonly tokens: Record<string, string>;
  /** Every text style the XML names: `h3` → its font shorthand. */
  readonly textStyles: Record<string, string>;
  /** The font families the texts use, with their weights (`"500 italic"` for italics). */
  readonly fonts: Record<string, string[]>;
  readonly assets: PlannedAsset[];
  /** Layers shown without their children: cut to fit maxChars, or past the snapshot's size budget. */
  readonly truncated: string[];
  /** Runs of alike layers read as their first, when the read was asked for repeats. */
  readonly repeats?: readonly RepeatRead[];
}

/** One value the layers of a run hold apart: an attribute of a layer of the template, or its text ($text). */
export interface RepeatField {
  readonly layer: string;
  /** Where the layer sits in the template, as nodes_diff names paths; none for the template itself. */
  readonly path?: string;
  readonly attribute: string;
}

/** A run of alike neighbours read as the first (the template): the layers in order, and each one's own values. */
export interface RepeatRead {
  readonly template: string;
  readonly layers: readonly string[];
  readonly fields: readonly RepeatField[];
  /** A row per layer, a value per field: a text with spans as its pieces. */
  readonly rows: readonly (readonly (string | readonly string[])[])[];
}

export interface DesignXmlOptions {
  /** The folder asset paths start with. Default `assets`. */
  readonly assetsPath?: string;
  /** Final asset paths by node, once files are written (same bytes share one file): replaces the planned ones. */
  readonly assetSrc?: ReadonlyMap<string, string>;
  /** Layers to show without their children (`$truncated="true"`), to fit the read into maxChars. */
  readonly cut?: ReadonlySet<string>;
  /**
   * To fit maxChars too: an element shows only its first N visible children (`$children` gives how many it has), a text
   * only its first N characters (`$truncated="true"`).
   */
  readonly limits?: ReadonlyMap<string, number>;
  /** Layers never taken for an asset: a parent rendered around one child, to compare that child as design_read wrote it. */
  readonly notAssets?: ReadonlySet<string>;
  /**
   * Instances a Code Connect template renders, by id, with their component's name: each is written with `$code` and
   * without its children, its code going with the read instead.
   */
  readonly connected?: ReadonlyMap<string, string>;
  /** Runs of three or more alike neighbours read as their first, marked `$repeat`, the others' values as rows. */
  readonly repeats?: boolean;
  /**
   * How an Auto line height is written: `normal` (default), or `px`, the px Figma renders it at where the read can tell
   * (a text that hugs its lines shows it for every text in its font and size), normal elsewhere.
   */
  readonly autoLineHeight?: "normal" | "px";
}

/** Where a layer's element sits in the XML's lines, for measuring and cutting branches. */
export interface DesignSpan {
  readonly start: number;
  readonly end: number;
  readonly level: number;
  readonly parent: string | null;
}
