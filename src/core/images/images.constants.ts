/** The format names an image sniffer gives, as image-size spells them. */
export const IMAGE_FORMAT = { png: "png" } as const;

/** What an added alpha channel holds where the image has pixels: fully opaque at the image's depth. */
export const PIXEL = { deepBits: 16, opaque: 0xff, opaqueDeep: 0xff_ff } as const;
