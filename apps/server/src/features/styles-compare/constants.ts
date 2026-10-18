/** Pairs one call compares: a screen's elements, not a whole site. */
export const STYLE_PAIRS_MAX = 100;

/** Computed properties one pair may give: a whole getComputedStyle holds 400 to 600. */
export const STYLE_PROPERTIES_MAX = 1_000;

/** How far a size or a place may be off by default, in px: layout rounds them. */
export const STYLE_TOLERANCE = 1;

export const NOT_GIVEN_NOTE =
  "notGiven lists what the design sets and css left out: read those properties with getComputedStyle and call again.";
