import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  APPLY_TAG,
  ATTRIBUTE,
  CHANGE_KIND,
  CSS_ATTRIBUTES,
  PATH_ATTRIBUTES,
  TEXT_TAGS,
} from "@/core/apply/apply.constants.ts";
import type { ApplyChange, ApplyElement, ApplyError, ApplyText, ContentPiece } from "@/core/apply/apply.types.ts";
import { PLAN_VALUE } from "@/core/apply/plan/plan.constants.ts";
import type { LayerNow } from "@/core/apply/plan/plan.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { WriteInput, WriteProblem } from "@/core/css/css.types.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { WRITE_REGISTRY } from "@/core/css/registry/write-registry.ts";
import type { XmlLocation } from "@/core/xml/parse/parse.types.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * An element as a change in Figma's terms (C-171): what the writers make of it (with `now`, only what the layer does
 * not have yet), with a Text's characters and a run per Span (C-119), in the envelope the plugin places it by. Errors
 * stand where the XML has them, a span's at the span, and come in the order of the element's attributes. `placed`:
 * nothing lays the layer out where it goes.
 */
@injectable()
export class ChangeOf {
  readonly #registry;

  constructor(registry = inject(WRITE_REGISTRY)) {
    this.#registry = registry;
  }

  of(
    element: ApplyElement,
    now?: LayerNow,
    placed = false,
  ): { change: ApplyChange; errors: ApplyError[] } {
    const input = this.#input(element, now, placed);
    const out = new ChangeOutput();

    this.#registry.write(input, out);

    const errors = out.problems.map((problem) => this.#error(element, element, problem));
    // A new text style resets the runs too: the characters and Spans are written again.
    const text =
      element.content !== undefined && (!(now?.text ?? false) || (input.restyled ?? false))
        ? this.#text(element, element.content, input.merged, errors)
        : undefined;
    const order = Object.keys(element.attributes);
    const rank = (error: ApplyError) => {
      const index = error.attribute === undefined ? -1 : order.indexOf(error.attribute);

      return index === -1 ? order.length : index;
    };

    return {
      change: this.#change(element, out, text),
      errors: [...errors].sort((first, second) => rank(first) - rank(second)),
    };
  }

  /** The CSS and path attributes of the element no writer handles yet: they are not in the change, and the dry run says so. */
  unwritten(element: ApplyElement): string[] {
    return Object.keys(element.attributes).filter(
      (name) => (CSS_ATTRIBUTES.has(name) || PATH_ATTRIBUTES.has(name)) && !this.#registry.owns(name),
    );
  }

  /**
   * What the writers make of attributes of an element with this tag, on no layer in particular: the Figma props and
   * the messages of the errors. A style's values are read with it (C-173): the same CSS means the same on a style as on
   * a layer (paint = background, text = font, letter-spacing and text-transform, effect = box-shadow and filters).
   */
  attributesProps(tag: string, attributes: Readonly<Record<string, string>>): { props: FigmaProps; errors: string[] } {
    const own = (name: string) => (Object.hasOwn(attributes, name) ? attributes[name] : undefined);
    const out = new ChangeOutput();

    this.#registry.write(
      { tag, own, merged: own, changed: (name) => Object.hasOwn(attributes, name), hidden: false, existing: false },
      out,
    );

    return { props: out.props, errors: out.problems.map(({ message }) => message) };
  }

  #change(
    element: ApplyElement,
    out: ChangeOutput,
    text: ApplyText | undefined,
  ): ApplyChange {
    const { attributes } = element;

    return {
      line: element.line,
      column: element.column,
      kind: element.id === null && element.source === undefined ? CHANGE_KIND.create : CHANGE_KIND.update,
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
    };
  }

  /** Characters from the text and its spans, and a run per span with what it sets over the text's own. */
  #text(
    element: ApplyElement,
    content: readonly ContentPiece[],
    base: WriteInput["merged"],
    errors: ApplyError[],
  ): ApplyText {
    let characters = "";
    const runs: ApplyText["runs"] = [];

    for (const piece of content) {
      const start = characters.length;

      characters += piece.value;

      if (piece.kind === XML_CONTENT.span) {
        const own = (name: string) => piece.attributes[name];
        const out = new ChangeOutput();

        this.#registry.write(
          {
            tag: APPLY_TAG.span,
            own,
            merged: (name) => own(name) ?? base(name),
            changed: (name) => own(name) !== undefined,
            hidden: false,
            existing: false,
          },
          out,
        );
        errors.push(...out.problems.map((problem) => this.#error(element, piece, problem)));
        runs.push({ start, end: characters.length, props: out.props });
      }
    }

    return { characters, runs };
  }

  #error(
    element: ApplyElement,
    at: XmlLocation,
    problem: WriteProblem,
  ): ApplyError {
    return { line: at.line, column: at.column, ...(element.id === null ? {} : { id: element.id }), ...problem };
  }

  /** What a write rule reads: the element's attributes, and the same over what the layer has now. */
  #input(
    element: ApplyElement,
    now: LayerNow | undefined,
    placed: boolean,
  ): WriteInput {
    const { attributes } = element;
    // Where nothing lays a layer out its edges place it, as design_read's position="absolute" there says.
    const current: Readonly<Record<string, string>> = {
      ...(placed ? { [CSS_PROPERTY.position]: PLAN_VALUE.absolute } : {}),
      ...now?.current,
    };
    const changed = (name: string) =>
      name !== ATTRIBUTE.id && attributes[name] !== undefined && !(now?.attributes.has(name) ?? false);

    return {
      tag: element.tag,
      own: (name) => attributes[name],
      merged: (name) => attributes[name] ?? current[name],
      changed,
      hidden: now !== undefined && !now.visible,
      existing: now !== undefined,
      // Applying a text style resets what it covers: the element's own overrides and its runs are written again.
      restyled: TEXT_TAGS.has(element.tag) && changed(ATTRIBUTE.textStyle),
    };
  }
}

export const CHANGE_OF = new InjectionToken<ChangeOf>("ChangeOf");
