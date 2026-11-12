import type { ASSET_KIND } from "@/core/design/assets/assets.constants.ts";
import type { FileKind } from "@/core/design/assets/assets.types.ts";

/** A file written, or the one reused for the same bytes: its path and the path planned, both under dir as given. */
export interface WrittenAsset {
  readonly node: string;
  readonly kind: FileKind;
  /** The image a background file holds; none for a layer's render. */
  readonly imageHash?: string;
  readonly path: string;
  readonly planned: string;
  readonly bytes: number;
}

/** A layer whose asset was not written, and why; a video is marked (B-001). */
export interface AssetError {
  readonly node: string;
  readonly message: string;
  readonly kind?: typeof ASSET_KIND.video;
}
