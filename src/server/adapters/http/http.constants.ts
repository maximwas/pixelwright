/**
 * npm's answer for the newest release (S-070); the dev channel's package is still `pixelwright`. A slow registry never
 * holds the server: past 3 s the last kept answer stands.
 */
export const NPM_LATEST = { url: "https://registry.npmjs.org/pixelwright/latest", timeoutMs: 3_000 } as const;
