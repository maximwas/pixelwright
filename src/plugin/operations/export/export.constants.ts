/** How Figma's export sizes a raster render: by a scale. */
export const EXPORT_CONSTRAINT = { scale: "SCALE" } as const;

/** A fitted scale is floored to 4 decimals: Figma rounds the rendered size, and 2000.4 px must not become 2001. */
export const EXPORT_FIT = { scaleSteps: 10_000 } as const;

export const EXPORT_TEXT = {
  notExportable: (id: string, type: string) => `${id} is a ${type.toLowerCase()}, which cannot be exported.`,
} as const;
