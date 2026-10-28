import { px } from "../../css-mapping/values/format.ts";
import { decimal } from "../../kernel/numbers.ts";
import { roleOf } from "../a11y/controls.ts";
import { componentStates } from "../states/component-states.ts";
import { findingOf, type LintRule } from "./lint-rule.ts";

/** The smallest pointer target WCAG 2.2 AA asks for (2.5.8), and the touch target of AAA and Apple's guidelines. */
const POINTER_TARGET = 24;
const TOUCH_TARGET = 44;

/** Texts below WCAG AA contrast with what is behind them; those over an image or a gradient, to check by eye. */
export const CONTRAST: LintRule = {
  id: "contrast",
  severity: "error",
  about: "Texts below WCAG AA contrast with what is behind them.",
  check: ({ node }, { contrast }) => {
    const rated = contrast.get(node.id);

    if (rated === undefined || rated.aa) {
      return [];
    }

    if (rated.ratio === null) {
      return [
        findingOf(CONTRAST, node, {
          severity: "info",
          message: `Its contrast is not one number (behind it: ${rated.backdrop}).`,
          fix: "Check it by eye in a screenshot, or give it a scrim.",
        }),
      ];
    }

    return [
      findingOf(CONTRAST, node, {
        message: `${decimal(rated.ratio)}:1 for ${rated.large ? "large" : "body"} text ${rated.color} on ${rated.backdrop}; AA needs ${rated.large ? 3 : 4.5}:1.`,
        fix: "Darken or lighten the text or what is behind it (contrast_check rates every text).",
      }),
    ];
  },
};

/** Pressable layers smaller than a pointer or a finger can hit. */
export const TOUCH_TARGET_RULE: LintRule = {
  id: "touch-target",
  severity: "warning",
  about: `Pressable layers under ${POINTER_TARGET}×${POINTER_TARGET} px (a warning) or ${TOUCH_TARGET}×${TOUCH_TARGET} px (info).`,
  check: ({ node }) => {
    const side = Math.min(node.width, node.height);

    // Pressed is what a11y_read gives a role: a prototype click on it, or an instance of a control component.
    if (roleOf(node) === null || side >= TOUCH_TARGET) {
      return [];
    }

    const small = side < POINTER_TARGET;

    return [
      findingOf(TOUCH_TARGET_RULE, node, {
        severity: small ? "warning" : "info",
        message: `${px(node.width)} × ${px(node.height)}: under the ${small ? `${POINTER_TARGET} px a pointer target needs (WCAG 2.5.8)` : `${TOUCH_TARGET} px a touch target needs (WCAG 2.5.5, Apple)`}.`,
        fix: "Give it padding or a minimum size, or a larger hit area in the build.",
      }),
    ];
  },
};

/** Interactive components used here whose variants lack the states the build needs (hover, focus, disabled…). */
export const MISSING_STATES: LintRule = {
  id: "missing-states",
  severity: "info",
  about: "Interactive components used here without hover, focus, disabled or the other states their kind needs.",
  check: ({ node }, { components, reportedSets }) => {
    const id = node.instance?.setId ?? node.instance?.componentId;
    const entry = id === undefined ? undefined : components.get(id);

    if (id === undefined || entry === undefined || reportedSets.has(id)) {
      return [];
    }

    reportedSets.add(id);

    const states = componentStates(entry);

    return states === null || states.missing.length === 0
      ? []
      : [
          findingOf(MISSING_STATES, entry, {
            message: `A ${states.kind} with no ${states.missing.join(", ")} state${states.missing.length === 1 ? "" : "s"}${states.present.length > 0 ? ` (it has ${states.present.join(", ")})` : ""}.`,
            fix: "Draw the missing variants; states_find lists every component's states.",
          }),
        ];
  },
};
