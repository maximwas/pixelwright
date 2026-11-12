/** Iconify's public API: icons and their sets, with no key. */
export const ICONIFY_API = "https://api.iconify.design";

/** How long one call to Iconify may take. */
export const ICONIFY_TIMEOUT_MS = 8_000;

/** The fewest icons Iconify's search pages by: smaller limits are taken from its first page. */
export const ICONIFY_SEARCH_PAGE = 32;

/** The most icons one search lists. */
export const ICON_SEARCH_MAX = 64;

/** An icon's height when the call gives none, in px. */
export const ICON_DEFAULT_SIZE = 24;

/** The colour an icon is drawn in before its paints are bound to a token: the value tokens_bind snaps. */
export const TOKEN_DRAFT_COLOR = "#000";
