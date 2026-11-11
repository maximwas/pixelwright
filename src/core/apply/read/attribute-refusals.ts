import {
  ATTRIBUTE,
  BOX_PAINT,
  DISPLAY_VALUES,
  LAYOUT_ATTRIBUTES,
  LAYOUT_TAGS,
  PATH_ATTRIBUTES,
  PROPERTY_ATTRIBUTES,
  SHAPE_TAGS,
  TEXT_ATTRIBUTES,
  TEXT_TAGS,
} from "@/core/apply/apply.constants.ts";
import { REFUSAL_TEXT } from "@/core/apply/read/read.constants.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { TAG } from "@/core/xml/tags.constants.ts";

/** An attribute on a tag, where design_apply reads it. */
export interface AttributeUse {
  readonly tag: string;
  readonly name: string;
  readonly value: string;
  /** Where a component may hold the layer: inside a new Component, or an existing layer or under one. */
  readonly inComponent: boolean;
}

/** A rule a tag's attribute can break: when it applies, and what to say and write instead. */
interface Refusal {
  readonly applies: (use: AttributeUse) => boolean;
  readonly message: (use: AttributeUse) => string;
  readonly hint: (use: AttributeUse) => string;
}

/**
 * C-163, T-137: why a tag cannot take an attribute. The rules are checked in this order and the first that applies
 * speaks; null when the tag can take it.
 */
export class AttributeRefusals {
  readonly #rules: readonly Refusal[] = [
    {
      applies: ({ tag, name }) => tag === TAG.PAGE && name !== ATTRIBUTE.id && name !== ATTRIBUTE.name,
      message: ({ name }) => REFUSAL_TEXT.pageName(name),
      hint: () => REFUSAL_TEXT.pageHint,
    },
    {
      applies: ({ name, inComponent }) => PROPERTY_ATTRIBUTES.has(name) && !inComponent,
      message: ({ name }) => REFUSAL_TEXT.property(name),
      hint: () => REFUSAL_TEXT.propertyHint,
    },
    {
      applies: ({ tag, name, value }) =>
        name === CSS_PROPERTY.display && !LAYOUT_TAGS.has(tag) && !DISPLAY_VALUES.has(value),
      message: ({ tag }) => REFUSAL_TEXT.display(tag),
      hint: () => REFUSAL_TEXT.displayHint,
    },
    {
      applies: ({ tag, name }) => LAYOUT_ATTRIBUTES.has(name) && !LAYOUT_TAGS.has(tag),
      message: ({ tag, name }) => REFUSAL_TEXT.layout(tag, name),
      hint: () => REFUSAL_TEXT.layoutHint,
    },
    {
      applies: ({ tag, name }) => TEXT_ATTRIBUTES.has(name) && !TEXT_TAGS.has(tag),
      message: ({ tag, name }) => REFUSAL_TEXT.text(tag, name),
      hint: () => REFUSAL_TEXT.textHint,
    },
    {
      applies: ({ tag, name }) => PATH_ATTRIBUTES.has(name) && tag !== TAG.TEXT_PATH,
      message: ({ tag, name }) => REFUSAL_TEXT.path(tag, name),
      hint: () => REFUSAL_TEXT.pathHint,
    },
    {
      applies: ({ tag, name }) => TEXT_TAGS.has(tag) && BOX_PAINT.has(name),
      message: ({ tag, name }) => REFUSAL_TEXT.textBox(tag, name),
      hint: ({ name }) => {
        if (name === CSS_PROPERTY.background) {
          return REFUSAL_TEXT.textBoxBackground;
        }

        return name === CSS_PROPERTY.boxShadow ? REFUSAL_TEXT.textBoxShadow : REFUSAL_TEXT.textBoxOther;
      },
    },
    {
      applies: ({ tag, name }) =>
        (tag === TAG.LINE || tag === TAG.GROUP) &&
        BOX_PAINT.has(name) &&
        // A line is drawn by its border; it has no corners to round.
        !(tag === TAG.LINE && name.startsWith(REFUSAL_TEXT.borderPrefix) && name !== CSS_PROPERTY.borderRadius),
      message: ({ tag, name }) => REFUSAL_TEXT.noPaint(tag, name),
      hint: ({ tag }) => (tag === TAG.LINE ? REFUSAL_TEXT.linePaintHint : REFUSAL_TEXT.groupPaintHint),
    },
    {
      applies: ({ tag, name }) => name === CSS_PROPERTY.overflow && SHAPE_TAGS.has(tag),
      message: ({ tag }) => REFUSAL_TEXT.overflow(tag),
      hint: () => REFUSAL_TEXT.overflowHint,
    },
  ];

  of(use: AttributeUse): { message: string; hint: string } | null {
    const refusal = this.#rules.find((rule) => rule.applies(use));

    return refusal === undefined ? null : { message: refusal.message(use), hint: refusal.hint(use) };
  }
}
