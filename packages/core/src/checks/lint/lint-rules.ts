import { CONTRAST, MISSING_STATES, TOUCH_TARGET_RULE } from "./access-rules.ts";
import { NO_AUTO_LAYOUT, OFF_SCALE, OVERFLOW } from "./layout-rules.ts";
import type { LintRule } from "./lint-rule.ts";
import { DEFAULT_NAMES, DETACHED, LEFTOVER, OVERRIDDEN } from "./tidy-rules.ts";
import { EFFECT_STYLE, RAW_COLOR, RAW_NUMBER, TEXT_STYLE } from "./token-rules.ts";

/** Every rule design_lint checks, in the order LINT_RULE_IDS names them. */
export const LINT_RULES: readonly LintRule[] = [
  CONTRAST,
  RAW_COLOR,
  TEXT_STYLE,
  DETACHED,
  NO_AUTO_LAYOUT,
  OVERFLOW,
  TOUCH_TARGET_RULE,
  MISSING_STATES,
  RAW_NUMBER,
  OFF_SCALE,
  EFFECT_STYLE,
  OVERRIDDEN,
  DEFAULT_NAMES,
  LEFTOVER,
];
