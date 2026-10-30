/** The formats an export renders: PNG for a screenshot; JPG, SVG and PDF for assets_export (WebP is encoded on the server). */
export const EXPORT_FORMAT = { png: "PNG", jpg: "JPG", svg: "SVG", pdf: "PDF" } as const;

/** The scales a render takes (T-070): Figma renders a layer at most 4x, and under 0.01 nothing is left of it. */
export const EXPORT_SCALE = { min: 0.01, max: 4 } as const;

/** A stream id is the server's random UUID: 36 characters, with room to spare. */
export const EXPORT_STREAM = { idChars: 100 } as const;
