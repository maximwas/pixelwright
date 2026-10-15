import { easingCss } from "../kernel/easing.ts";
import type { SnapshotReaction } from "../types/snapshot.ts";

/** The read-only attribute each trigger is written as. */
const TRIGGER_ATTRIBUTES: Readonly<Record<string, string>> = {
  ON_CLICK: "$on-click",
  ON_HOVER: "$on-hover",
  ON_PRESS: "$on-press",
  ON_DRAG: "$on-drag",
  MOUSE_ENTER: "$on-mouse-enter",
  MOUSE_LEAVE: "$on-mouse-leave",
  MOUSE_DOWN: "$on-mouse-down",
  MOUSE_UP: "$on-mouse-up",
  ON_KEY_DOWN: "$on-key",
  AFTER_TIMEOUT: "$after-timeout",
  ON_MEDIA_HIT: "$on-media-hit",
  ON_MEDIA_END: "$on-media-end",
};

/** What a NODE action does with its destination. */
const NAVIGATIONS: Readonly<Record<string, string>> = {
  NAVIGATE: "go to",
  CHANGE_TO: "change to",
  OVERLAY: "open overlay",
  SWAP: "swap overlay to",
  SCROLL_TO: "scroll to",
};

type Action = NonNullable<SnapshotReaction["actions"]>[number];
type Transition = NonNullable<Action["transition"]>;

const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
const words = (constant: string) => constant.toLowerCase().replaceAll("_", " ");

/**
 * A layer's prototype interactions as read-only attributes, one per trigger: `$on-hover="change to Type=Hover; smart
 * animate 300ms ease-out"`. A reaction that only opens a URL is left to href.
 */
export function interactionAttributes(reactions: readonly SnapshotReaction[]): [string, string][] {
  const byAttribute = new Map<string, string[]>();

  for (const reaction of reactions) {
    const actions = reaction.actions ?? [];

    if (reaction.trigger === null || actions.length === 0 || actions.every((action) => action.type === "URL")) {
      continue;
    }

    const attribute =
      TRIGGER_ATTRIBUTES[reaction.trigger.type] ??
      `$on-${words(reaction.trigger.type.replace(/^ON_/, "")).replaceAll(" ", "-")}`;

    byAttribute.set(attribute, [...(byAttribute.get(attribute) ?? []), interactionSummary(reaction)]);
  }

  return [...byAttribute].map(([attribute, summaries]) => [attribute, summaries.join(" | ")]);
}

/** One interaction in words: a wait, what it does, how it moves. */
export function interactionSummary(reaction: SnapshotReaction): string {
  const trigger = reaction.trigger;
  const wait = trigger?.timeout ?? trigger?.delay ?? 0;

  return [wait > 0 ? `after ${ms(wait)}` : null, ...(reaction.actions ?? []).map(actionText)]
    .filter((part) => part !== null)
    .join("; ");
}

function actionText(action: Action): string {
  if (action.type === "NODE") {
    const where = action.destinationName ?? action.destinationId ?? "nothing";
    const what = `${NAVIGATIONS[action.navigation ?? ""] ?? words(action.navigation ?? "go to")} ${where}`;

    return action.transition === null || action.transition === undefined
      ? `${what}; instant`
      : `${what}; ${transitionText(action.transition)}`;
  }

  const simple: Readonly<Record<string, string>> = {
    BACK: "back",
    CLOSE: "close overlay",
    SET_VARIABLE: "set a variable",
    SET_VARIABLE_MODE: "set a variable mode",
    CONDITIONAL: "if / else",
    UPDATE_MEDIA_RUNTIME: "control the media",
  };

  return action.type === "URL" ? `open ${action.url ?? "a link"}` : (simple[action.type] ?? words(action.type));
}

function transitionText(transition: Transition): string {
  const direction = transition.direction === undefined ? "" : ` ${transition.direction.toLowerCase()}`;

  return `${words(transition.type)}${direction} ${ms(transition.duration)} ${easingCss(transition.easing) ?? words(transition.easing.type)}`;
}
