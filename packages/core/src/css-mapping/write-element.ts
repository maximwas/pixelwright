import type { ApplyChange, ApplyElement, ApplyError, FigmaProps, LayerNow, TextRunSpec } from "../types/apply.ts";
import type { XmlChild } from "../types/xml.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "./property-group.ts";
import { BOX_RULES, SPAN_RULES, TEXT_RULES } from "./registry.ts";

/**
 * An element as a change in Figma's terms, through the mapping table backwards. With `now` (unchangedAttributes), only
 * what the layer does not have yet is written, and what Figma keeps in one property is completed from what the layer
 * has: a new gap keeps the direction, a blur keeps the shadows. An attribute the element leaves out stays as it is. A
 * value that cannot be written is an error on its attribute; the rest of the element still applies.
 */
export function changeOf(element: ApplyElement, now?: LayerNow): { change: ApplyChange; errors: ApplyError[] } {
  const errors: ApplyError[] = [];
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
  const out = new ChangeOutput(element, element.id, errors);
  // Applying a text style resets what it covers: the element's own overrides and its runs are written again.
  const restyled = element.tag === "Text" && changed("textStyle");

  translate(BOX_RULES, input, out, false);
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
      props: out.props,
      sources: out.sources,
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
    const out = new ChangeOutput(child, id, errors);

    characters += textIn(child.children);
    translate(
      SPAN_RULES,
      {
        tag: "Span",
        own: (name) => child.props[name],
        merged: (name) => child.props[name] ?? base(name),
        changed: (name) => child.props[name] !== undefined,
        hidden: false,
      },
      out,
      false,
    );
    runs.push({
      start,
      end: characters.length,
      props: out.props,
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

/**
 * What the mapping writes for one attribute of an element with this tag, on no layer in particular: the Figma props it
 * gives and the messages of its errors. A style's value is read with it: the same CSS means the same on a style as on
 * a layer.
 */
export function attributeProps(tag: string, attribute: string, value: string): { props: FigmaProps; errors: string[] } {
  const errors: ApplyError[] = [];
  const own = (name: string) => (name === attribute ? value : undefined);
  const input: WriteInput = {
    tag,
    own,
    merged: own,
    changed: (name) => name === attribute,
    hidden: false,
  };
  const out = new ChangeOutput(
    {
      line: 1,
      column: 1,
    },
    null,
    errors,
  );

  translate(BOX_RULES, input, out, false);
  translate(TEXT_RULES, input, out, false);

  return {
    props: out.props,
    errors: errors.map(({ message }) => message),
  };
}

/** Where a write's rules put Figma properties and the attribute each came from, and where its errors go. */
class ChangeOutput implements WriteOutput {
  readonly props: FigmaProps = {};
  readonly sources: Partial<Record<keyof FigmaProps, string>> = {};
  readonly #location: { readonly line: number; readonly column: number };
  readonly #id: string | null;
  readonly #errors: ApplyError[];

  constructor(location: { readonly line: number; readonly column: number }, id: string | null, errors: ApplyError[]) {
    this.#location = location;
    this.#id = id;
    this.#errors = errors;
  }

  set<K extends keyof FigmaProps>(key: K, value: Exclude<FigmaProps[K], undefined>, attribute: string): void {
    this.props[key] = value;
    this.sources[key] = attribute;
  }

  fail(attribute: string, message: string, hint?: string): void {
    this.#errors.push({
      line: this.#location.line,
      column: this.#location.column,
      ...(this.#id === null ? {} : { id: this.#id }),
      attribute,
      message,
      ...(hint === undefined ? {} : { hint }),
    });
  }
}
