import { APPEARANCE_RULES } from "./groups/appearance.ts";
import { EFFECTS_RULE } from "./groups/effects.ts";
import { ELEMENT_RULES, HREF_RULE } from "./groups/element.ts";
import { GEOMETRY_RULES } from "./groups/geometry/geometry.ts";
import { LAYOUT_RULES } from "./groups/layout/layout.ts";
import { BACKGROUND_RULE } from "./groups/paint/fills.ts";
import { STROKES_RULE } from "./groups/paint/strokes.ts";
import { TEXT_PATH_RULES } from "./groups/text/path.ts";
import { TEXT_RULES } from "./groups/text/rules.ts";
import type { Rule } from "./property-group.ts";

/**
 * The mapping table backwards, group by group: what any element writes, in this order (later rules see what earlier
 * ones set), then what a Text writes over it, a TextPath's path, and what a run of text (a Span) may set.
 */
export const BOX_RULES: readonly Rule[] = [
  ...ELEMENT_RULES,
  ...LAYOUT_RULES,
  ...GEOMETRY_RULES,
  ...APPEARANCE_RULES,
  BACKGROUND_RULE,
  STROKES_RULE,
  EFFECTS_RULE,
];

// The path rules stand apart from the box's: a style's value never names a path, and the plugin's bundle, which reads
// styles, stays without the path parser.
export { TEXT_PATH_RULES, TEXT_RULES };

export const SPAN_RULES: readonly Rule[] = [HREF_RULE, ...TEXT_RULES];
