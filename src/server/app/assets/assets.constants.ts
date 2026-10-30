/** How an asset renders (S-100): rasters at 2x, sharp on the screens a build targets; vectors at their own size. */
export const ASSET_RENDER = { rasterScale: 2, vectorScale: 1 } as const;

/** WebP's quality (S-095): 85 when none is asked, libwebp's usual balance; the alpha is lossless at any (B-063). */
export const WEBP_QUALITY = { default: 85, min: 1, max: 100 } as const;

/** The formats an asset file is written in, in assets_export's order; WEBP is encoded here from Figma's PNG. */
export const ASSET_FILE_FORMAT = { png: "PNG", jpg: "JPG", webp: "WEBP", svg: "SVG", pdf: "PDF" } as const;

/** The extensions an original takes from its bytes (S-096): the formats Figma keeps images in; others keep the plan's. */
export const ORIGINAL_EXTENSIONS = { png: true, jpg: true, gif: true, webp: true } as const;

/** Same bytes are one file by SHA-256; written-files.json keys files by SHA-1, as 0.7.0's store did (S-101). */
export const ASSET_DIGEST = { same: "sha256", store: "sha1", encoding: "hex" } as const;

/** A clashing name's first number: the first file keeps the bare name, the second is `-2` (C-144). */
export const ASSET_NUMBER = { first: 2 } as const;

export const ASSETS_TEXT = {
  named: (stem: string, extension: string) => `${stem}.${extension}`,
  numbered: (
    stem: string,
    number: number,
    extension: string,
  ) => `${stem}-${number}${extension}`,
} as const;
