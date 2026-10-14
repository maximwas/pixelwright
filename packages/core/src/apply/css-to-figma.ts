import { APPEARANCE_RULES } from "../css-mapping/groups/appearance.ts";
import { EFFECTS_RULE } from "../css-mapping/groups/effects.ts";
import { ELEMENT_RULES, HREF_RULE } from "../css-mapping/groups/element.ts";
import { GEOMETRY_RULES } from "../css-mapping/groups/geometry/geometry.ts";
import { LAYOUT_RULES } from "../css-mapping/groups/layout/layout.ts";
import { BACKGROUND_RULE } from "../css-mapping/groups/paint/fills.ts";
import { STROKES_RULE } from "../css-mapping/groups/paint/strokes.ts";
import { TEXT_RULES } from "../css-mapping/groups/text/rules.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../css-mapping/property-group.ts";
import type { ApplyChange, ApplyElement, ApplyError, FigmaProps, LayerNow, TextRunSpec } from "../types/apply.ts";
import type { XmlChild } from "../types/xml.ts";

const RULES: readonly Rule[] = [
  ...ELEMENT_RULES,
  ...LAYOUT_RULES,
  ...GEOMETRY_RULES,
  ...APPEARANCE_RULES,
  BACKGROUND_RULE,
  STROKES_RULE,
  EFFECTS_RULE,
];

/**
 * An element as a change in Figma's terms, through the mapping table backwards. With `now` (unchangedAttributes), only
 * what the layer does not have yet is written, and what Figma keeps in one property is completed from what the layer
 * has: a new gap keeps the direction, a blur keeps the shadows. An attribute the element leaves out stays as it is. A
 * value that cannot be written is an error on its attribute; the rest of the element still applies.
 */
export function changeOf(element: ApplyElement, now?: LayerNow): { change: ApplyChange; errors: ApplyError[] } {
  const errors: ApplyError[] = [];
  const props: FigmaProps = {};
  const sources: Partial<Record<keyof FigmaProps, string>> = {};
  const attributes = element.attributes;
  const current = now?.current ?? {};
  const changed = (name: string) =>
    name !== "id" && attributes[name] !== undefined && !(now?.attributes.has(name) ?? false);
  const input: WriteInput = {
    tag: element.tag,
    own: (name) => attributes[name],
    merged: (name) => attributes[name] ?? current[name],
    changed,
    hidden: now !== undefined && !now.visible,
  };
  const out = output(element, element.id, props, sources, errors);
  // Applying a text style resets what it covers: the element's own overrides and its runs are written again.
  const restyled = element.tag === "Text" && changed("textStyle");

  translate(RULES, input, out, false);
  translate(TEXT_RULES, input, out, restyled);

  const text =
    element.content !== undefined && (!(now?.text ?? false) || restyled)
      ? textOf(element.content, input.merged, element.id, errors)
      : undefined;
  const order = Object.keys(attributes);
  const rank = (error: ApplyError) => {
    const index = error.attribute === undefined ? -1 : order.indexOf(error.attribute);

    return index === -1 ? order.length : index;
  };

  return {
    change: {
      line: element.line,
      column: element.column,
      kind: element.id === null && element.source === undefined ? "create" : "update",
      ref: element.ref,
      id: element.id,
      tag: element.tag,
      parent: element.parent,
      index: element.index,
      ...(attributes.before === undefined ? {} : { before: attributes.before }),
      ...(attributes.after === undefined ? {} : { after: attributes.after }),
      props,
      sources,
      ...(text === undefined ? {} : { text }),
      ...(attributes.copyOf === undefined ? {} : { copyOf: attributes.copyOf }),
      ...(element.source === undefined ? {} : { source: element.source }),
      ...(element.copy === undefined ? {} : { copy: element.copy }),
    },
    errors: errors.toSorted((a, b) => rank(a) - rank(b)),
  };
}

function translate(rules: readonly Rule[], input: WriteInput, out: WriteOutput, restyled: boolean): void {
  for (const rule of rules) {
    const forced = restyled && rule.styled && rule.attributes.some((name) => input.own(name) !== undefined);

    if (forced || rule.attributes.some(input.changed)) {
      rule.write(
        forced
          ? {
              ...input,
              merged: input.own,
            }
          : input,
        out,
      );
    }
  }
}

function output(
  location: { readonly line: number; readonly column: number },
  id: string | null,
  props: FigmaProps,
  sources: Partial<Record<keyof FigmaProps, string>>,
  errors: ApplyError[],
): WriteOutput {
  return {
    set(key, value, attribute) {
      (props as Record<string, unknown>)[key] = value;
      sources[key] = attribute;
    },
    fail(attribute, message, hint) {
      errors.push({
        line: location.line,
        column: location.column,
        ...(id === null ? {} : { id }),
        attribute,
        message,
        ...(hint === undefined ? {} : { hint }),
      });
    },
  };
}

/** Characters from text and spans, and a run per span with what it sets over the text's own. */
function textOf(
  content: readonly XmlChild[],
  base: AttributeReader,
  id: string | null,
  errors: ApplyError[],
): { characters: string; runs: TextRunSpec[] } {
  let characters = "";
  const runs: TextRunSpec[] = [];

  for (const child of content) {
    if (child.kind === "text") {
      characters += child.value;
      continue;
    }

    const start = characters.length;
    const props: FigmaProps = {};

    characters += textIn(child.children);
    translate(
      [HREF_RULE, ...TEXT_RULES],
      {
        tag: "Span",
        own: (name) => child.props[name],
        merged: (name) => child.props[name] ?? base(name),
        changed: (name) => child.props[name] !== undefined,
        hidden: false,
      },
      output(child, id, props, {}, errors),
      false,
    );
    runs.push({
      start,
      end: characters.length,
      props,
    });
  }

  return {
    characters,
    runs,
  };
}

function textIn(children: readonly XmlChild[]): string {
  return children.map((child) => (child.kind === "text" ? child.value : textIn(child.children))).join("");
}
