import { isModeAttribute } from "../kernel/names.ts";
import type { FigmaProps, TextRunSpec } from "./figma-props.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "./property-group.ts";
import { BOX_RULES, SPAN_RULES, TEXT_RULES } from "./registry.ts";

/** What a layer has now, measured against an element (unchangedAttributes): the mapping writes only the rest. */
export interface LayerNow {
  /** The element's attributes the layer already has, as design_read writes them: they are not written again. */
  readonly attributes: ReadonlySet<string>;
  /** Whether the layer's text already reads as the element's. */
  readonly text: boolean;
  /** Whether the layer is visible: a hidden one is shown again by a display other than none. */
  readonly visible: boolean;
  /** The layer's attributes as design_read writes them now: they complete what Figma keeps in one property. */
  readonly current: Readonly<Record<string, string>>;
}

/** A piece of a text's content to write: plain characters, or a span's with what it sets over the text's own. */
export type TextPiece =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "span"; readonly attributes: Readonly<Record<string, string>>; readonly value: string };

/** An element as the mapping writes it: its tag, its attributes as given, a Text's content. */
export interface ElementInput {
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly content?: readonly TextPiece[];
  /** Whether nothing lays its layer out where it goes (the page, a section, a frame without auto layout): as absolute. */
  readonly placed?: boolean;
}

/** A value the mapping could not write: its attribute, why, what to do, and the content piece it is in (a span's). */
export interface WriteProblem {
  readonly attribute: string;
  readonly message: string;
  readonly hint?: string;
  readonly piece?: number;
}

/** An element in Figma's terms: the props, the attribute each came from, the text to write, and the problems. */
export interface ElementWrite {
  readonly props: FigmaProps;
  readonly sources: Partial<Record<keyof FigmaProps, string>>;
  readonly text?: { readonly characters: string; readonly runs: TextRunSpec[] };
  readonly problems: WriteProblem[];
}

/**
 * An element in Figma's terms, through the mapping table backwards. With `now` (unchangedAttributes), only what the
 * layer does not have yet is written, and what Figma keeps in one property is completed from what the layer has: a new
 * gap keeps the direction, a blur keeps the shadows. An attribute the element leaves out stays as it is. A value that
 * cannot be written is a problem on its attribute; the rest of the element still applies.
 */
export function writeElement(element: ElementInput, now?: LayerNow): ElementWrite {
  const problems: WriteProblem[] = [];
  const attributes = element.attributes;
  // Where nothing lays a layer out its edges place it, as design_read's position="absolute" there says.
  const current: Readonly<Record<string, string>> = {
    ...((element.placed ?? false) ? { position: "absolute" } : {}),
    ...now?.current,
  };
  const changed = (name: string) =>
    name !== "id" && attributes[name] !== undefined && !(now?.attributes.has(name) ?? false);
  const input: WriteInput = {
    tag: element.tag,
    own: (name) => attributes[name],
    merged: (name) => attributes[name] ?? current[name],
    changed,
    hidden: now !== undefined && !now.visible,
  };
  const out = new ChangeOutput(problems);
  // Applying a text style resets what it covers: the element's own overrides and its runs are written again.
  const restyled = element.tag === "Text" && changed("textStyle");

  translate(BOX_RULES, input, out, false);
  translate(TEXT_RULES, input, out, restyled);
  writeModes(attributes, changed, out);

  const text =
    element.content !== undefined && (!(now?.text ?? false) || restyled)
      ? textOf(element.content, input.merged, problems)
      : undefined;

  return {
    props: out.props,
    sources: out.sources,
    ...(text === undefined ? {} : { text }),
    problems,
  };
}

/** The variable modes the element's data attributes set (`data-theme="dark"`); an empty one clears its collection's. */
function writeModes(
  attributes: Readonly<Record<string, string>>,
  changed: (name: string) => boolean,
  out: WriteOutput,
): void {
  const modes = Object.entries(attributes).filter(([name]) => isModeAttribute(name) && changed(name));
  const [first] = modes;

  if (first !== undefined) {
    out.set(
      "modes",
      Object.fromEntries(modes.map(([name, value]) => [name.slice("data-".length), value.trim()])),
      first[0],
    );
  }
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
  content: readonly TextPiece[],
  base: AttributeReader,
  problems: WriteProblem[],
): { characters: string; runs: TextRunSpec[] } {
  let characters = "";
  const runs: TextRunSpec[] = [];

  content.forEach((piece, index) => {
    if (piece.kind === "text") {
      characters += piece.value;

      return;
    }

    const start = characters.length;
    const out = new ChangeOutput(problems, index);

    characters += piece.value;
    translate(
      SPAN_RULES,
      {
        tag: "Span",
        own: (name) => piece.attributes[name],
        merged: (name) => piece.attributes[name] ?? base(name),
        changed: (name) => piece.attributes[name] !== undefined,
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
  });

  return {
    characters,
    runs,
  };
}

/**
 * What the mapping writes for one attribute of an element with this tag, on no layer in particular: the Figma props it
 * gives and the messages of its errors. A style's value is read with it: the same CSS means the same on a style as on
 * a layer.
 */
export function attributeProps(tag: string, attribute: string, value: string): { props: FigmaProps; errors: string[] } {
  return attributesProps(tag, { [attribute]: value });
}

/** attributeProps for several attributes of one element, read together (a font with its spacing, shadows with blurs). */
export function attributesProps(
  tag: string,
  attributes: Readonly<Record<string, string>>,
): { props: FigmaProps; errors: string[] } {
  const problems: WriteProblem[] = [];
  const own = (name: string) => (Object.hasOwn(attributes, name) ? attributes[name] : undefined);
  const input: WriteInput = {
    tag,
    own,
    merged: own,
    changed: (name) => Object.hasOwn(attributes, name),
    hidden: false,
  };
  const out = new ChangeOutput(problems);

  translate(BOX_RULES, input, out, false);
  translate(TEXT_RULES, input, out, false);

  return {
    props: out.props,
    errors: problems.map(({ message }) => message),
  };
}

/** Where a write's rules put Figma properties and the attribute each came from, and where its problems go. */
class ChangeOutput implements WriteOutput {
  readonly props: FigmaProps = {};
  readonly sources: Partial<Record<keyof FigmaProps, string>> = {};
  readonly #problems: WriteProblem[];
  readonly #piece: number | undefined;

  /** `piece`: the content piece (a span) the rules write, when they write one. */
  constructor(problems: WriteProblem[], piece?: number) {
    this.#problems = problems;
    this.#piece = piece;
  }

  set<K extends keyof FigmaProps>(key: K, value: Exclude<FigmaProps[K], undefined>, attribute: string): void {
    this.props[key] = value;
    this.sources[key] = attribute;
  }

  fail(attribute: string, message: string, hint?: string): void {
    this.#problems.push({
      attribute,
      message,
      ...(hint === undefined ? {} : { hint }),
      ...(this.#piece === undefined ? {} : { piece: this.#piece }),
    });
  }
}
