import type { ASSET_KIND } from "@/core/design/assets/assets.constants.ts";

type AssetKind = (typeof ASSET_KIND)[keyof typeof ASSET_KIND];

/** The kinds exported as a file: a video is not (the Plugin API cannot export it, D-23). */
export type FileKind = Exclude<AssetKind, typeof ASSET_KIND.video>;

/** What a layer is exported as: a file in a format, at a scale when not its own size, or a video. */
export type AssetClass =
  | { readonly kind: FileKind; readonly format: string; readonly scale?: number }
  | { readonly kind: typeof ASSET_KIND.video };

/** A file a read plans, as the JSON block lists it: a layer's render, or an image behind content (`imageHash`). */
export interface PlannedFile {
  readonly node: string;
  readonly kind: FileKind;
  readonly format: string;
  readonly src: string;
  readonly scale?: number;
  readonly imageHash?: string;
}

/** An entry of the JSON block's `assets`: a planned file, or a video with no file. */
export type PlannedAsset = PlannedFile | { readonly node: string; readonly kind: typeof ASSET_KIND.video };
