import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import {
  ACTION_TYPE,
  INTERACTION_TEXT,
  NAVIGATIONS,
  SIMPLE_ACTIONS,
  TRIGGER_ATTRIBUTES,
} from "@/core/design/interactions/interactions.constants.ts";
import { EASING_CSS } from "@/core/kernel/easing/easing-css.ts";
import type { XmlAttribute } from "@/core/xml/xml.types.ts";
import type { ReactionSchema } from "@/shared/read-model/layer-values.schema.ts";

type Reaction = zod.output<typeof ReactionSchema>;
type Trigger = NonNullable<Reaction["trigger"]>;
type Action = NonNullable<Reaction["actions"]>[number];
type Transition = NonNullable<Action["transition"]>;

/**
 * A layer's prototype interactions as read-only attributes, one per trigger (C-154): `$on-hover="change to
 * Type=Hover; smart animate 300ms ease-out"`, a trigger's interactions joined by ` | `. A reaction that only opens a
 * URL is left to href; durations in ms, easings through the one EasingCss (D-64).
 */
@injectable()
export class InteractionAttributes {
  readonly #easing;

  constructor(easing = inject(EASING_CSS)) {
    this.#easing = easing;
  }

  read(reactions: readonly Reaction[]): XmlAttribute[] {
    const byAttribute = new Map<string, string[]>();

    for (const { trigger, actions = [] } of reactions) {
      if (trigger === null || actions.every((action) => action.type === ACTION_TYPE.url)) {
        continue;
      }

      const attribute = TRIGGER_ATTRIBUTES[trigger.type] ?? this.#otherTrigger(trigger.type);

      byAttribute.set(attribute, [...(byAttribute.get(attribute) ?? []), this.#sentence(trigger, actions)]);
    }

    return [...byAttribute].map(([attribute, sentences]) => [attribute, sentences.join(INTERACTION_TEXT.joiner)]);
  }

  /** One interaction in words, as its attribute holds it (inspect's summary, T-080). */
  sentence({ trigger, actions = [] }: Reaction): string {
    return this.#sentence(trigger, actions);
  }

  /** One interaction in words: a wait, what it does, how it moves. */
  #sentence(trigger: Trigger | null, actions: readonly Action[]): string {
    const wait = trigger?.timeout ?? trigger?.delay ?? 0;

    return [
      ...(wait > 0 ? [INTERACTION_TEXT.after(this.#ms(wait))] : []),
      ...actions.map((action) => this.#action(action)),
    ].join(INTERACTION_TEXT.step);
  }

  #action(action: Action): string {
    if (action.type === ACTION_TYPE.node) {
      const navigation = action.navigation ?? INTERACTION_TEXT.navigate;
      const where = action.destinationName ?? action.destinationId ?? INTERACTION_TEXT.nothing;
      const what = INTERACTION_TEXT.goes(NAVIGATIONS[navigation] ?? this.#words(navigation), where);
      const transition = action.transition ?? null;

      return [what, transition === null ? INTERACTION_TEXT.instant : this.#transition(transition)].join(
        INTERACTION_TEXT.step,
      );
    }

    if (action.type === ACTION_TYPE.url) {
      return INTERACTION_TEXT.open(action.url ?? INTERACTION_TEXT.link, action.openInNewTab ?? false);
    }

    return SIMPLE_ACTIONS[action.type] ?? this.#words(action.type);
  }

  /** How it moves: the animation, its direction, its duration, its easing (a spring by its Figma name). */
  #transition({ type, direction, duration, easing }: Transition): string {
    return [
      this.#words(type),
      ...(direction === undefined ? [] : [direction.toLowerCase()]),
      this.#ms(duration),
      this.#easing.css(easing) ?? this.#words(easing.type),
    ].join(INTERACTION_TEXT.space);
  }

  #otherTrigger(type: string): string {
    return INTERACTION_TEXT.trigger(
      this.#words(type.replace(INTERACTION_TEXT.onPrefix, "")).replaceAll(
        INTERACTION_TEXT.space,
        INTERACTION_TEXT.dash,
      ),
    );
  }

  #ms(seconds: number): string {
    return INTERACTION_TEXT.ms(Math.round(seconds * INTERACTION_TEXT.msPerSecond));
  }

  /** A Figma constant in words: SMART_ANIMATE is "smart animate". */
  #words(constant: string): string {
    return constant.toLowerCase().replace(INTERACTION_TEXT.underscore, INTERACTION_TEXT.space);
  }
}

export const INTERACTION_ATTRIBUTES = new InjectionToken<InteractionAttributes>("InteractionAttributes");
