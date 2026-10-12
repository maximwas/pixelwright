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
  /** Every token the XML refers to: `--Dark` → `#191A23`. */
  readonly tokens: Record<string, string>;
  /** Every text style the XML names: `h3` → its font shorthand. */
  readonly textStyles: Record<string, string>;
  /** The font families the texts use, with their weights (`"500 italic"` for italics). */
  readonly fonts: Record<string, string[]>;
  readonly assets: PlannedAsset[];
  /** Layers shown without their children: cut to fit maxChars, or past the snapshot's size budget. */
  readonly truncated: string[];
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
}

/** Where a layer's element sits in the XML's lines, for measuring and cutting branches. */
export interface DesignSpan {
  readonly start: number;
  readonly end: number;
  readonly level: number;
  readonly parent: string | null;
}
