import {
  APPLY_PATTERN,
  APPLY_TAG,
  ATTRIBUTE,
  CSS_ATTRIBUTES,
  META_ATTRIBUTES,
  TEXT_TAGS,
} from "@/core/apply/apply.constants.ts";
import type { ApplyElement, ApplyError, ApplyReading, ContentPiece, ElementNode } from "@/core/apply/apply.types.ts";
import type { Admission, AdmissionRefusal } from "@/core/apply/read/admission.ts";
import type { AttributeRefusals } from "@/core/apply/read/attribute-refusals.ts";
import {
  ADMISSION_ACTION,
  HABIT_HINT,
  HABIT_UNIT,
  READ_REF,
  READ_RULE,
  READ_TEXT,
} from "@/core/apply/read/read.constants.ts";
import { ReadScope } from "@/core/apply/read/read-scope.ts";
import type { TextPieces } from "@/core/apply/read/text-pieces.ts";
import type { Closest } from "@/core/kernel/names/closest.ts";
import { XML_NODE_KIND } from "@/core/xml/parse/parse.constants.ts";
import type { XmlNode } from "@/core/xml/parse/parse.types.ts";
import { TAG } from "@/core/xml/tags.constants.ts";

/** What the reader works out for one element it admits. */
interface ReadElement {
  readonly node: ElementNode;
  readonly scope: ReadScope;
  readonly index: number;
  readonly id: string | null;
  readonly ref: string;
  readonly source: string | null;
  readonly attributes: Record<string, string>;
  readonly content: ContentPiece[];
}

/** The collaborators of a reading. */
export interface ReaderParts {
  readonly admission: Admission;
  readonly refusals: AttributeRefusals;
  readonly pieces: TextPieces;
  readonly closest: Closest;
}

/**
 * C-160: reads design_apply's XML into elements in document order, collecting the errors: each element is admitted
 * (or turned away with its children read as the admission says), its attributes kept or refused, its text read as
 * pieces. One reader per reading: it holds the refs and ids given so far.
 */
export class ApplyReader {
  readonly #parts: ReaderParts;
  readonly #elements: ApplyElement[] = [];
  readonly #errors: ApplyError[] = [];
  /** The refs given so far: unique in the call. */
  readonly #refs = new Set<string>();
  /** The ids named so far outside copies. */
  readonly #ids = new Set<string>();

  constructor(parts: ReaderParts) {
    this.#parts = parts;
  }

  read(nodes: readonly XmlNode[]): ApplyReading {
    this.#readAll(nodes, ReadScope.top());

    return { elements: this.#elements, errors: this.#errors, invalidXml: false };
  }

  #readAll(nodes: readonly XmlNode[], scope: ReadScope): void {
    let index = 0;

    for (const node of nodes) {
      if (node.kind === XML_NODE_KIND.text) {
        this.#errors.push({
          line: node.line,
          column: node.column,
          message: READ_TEXT.strayText(node.value.slice(0, READ_RULE.quoted)),
        });
        continue;
      }

      this.#element(node, scope, index);
      index += 1;
    }
  }

  #element(
    node: ElementNode,
    scope: ReadScope,
    index: number,
  ): void {
    const named = node.props.id ?? null;
    // Inside a copy an id names the source's layer: the element writes its copy, a layer of its own.
    const source = scope.copy === null ? null : named;
    const id = source === null ? named : null;
    const place = this.#place(node, named);
    const refusal = this.#parts.admission.of({
      node,
      scope,
      named,
      source,
      id,
      seen: scope.copy === null ? this.#ids : scope.copy.seen,
    });

    if (refusal !== null) {
      this.#turnAway(node, scope, place, refusal);

      return;
    }

    const ref = this.#ref(id, node);
    const attributes = this.#attributes(node, scope, place);
    // No content leaves the text as it is: a partial edit (<Text id="…" color="…"/>) never empties it, and a text
    // design_read shortened to fit maxChars is never written back shortened (C-165).
    const text = TEXT_TAGS.has(node.type);
    const content =
      text && node.props[ATTRIBUTE.truncated] !== READ_RULE.trueValue ? this.#parts.pieces.of(node, this.#errors) : [];

    this.#elements.push(this.#elementOf({ node, scope, index, id, ref, source, attributes, content }));

    if (!text) {
      this.#readAll(
        node.children,
        scope.child({
          ref,
          tag: node.type,
          creating: id === null && source === null,
          copying: attributes.copyOf !== undefined,
          existing: id !== null,
          component: node.type === TAG.COMPONENT,
          instance: node.type === TAG.INSTANCE,
        }),
      );
    }
  }

  /** An element not read: its error, then its children as the admission says. */
  #turnAway(
    node: ElementNode,
    scope: ReadScope,
    place: Place,
    refusal: AdmissionRefusal,
  ): void {
    this.#errors.push({
      ...place,
      message: refusal.message,
      ...(refusal.hint === undefined ? {} : { hint: refusal.hint }),
    });

    // A text's or a span's own characters are its content, not layers: only the elements in it are read.
    const children =
      TEXT_TAGS.has(node.type) || node.type === APPLY_TAG.span
        ? node.children.filter(({ kind }) => kind === XML_NODE_KIND.element)
        : node.children;

    // Inside a copy a refused element's id names the source's layer: a new layer under it would land in the original.
    if (refusal.action === ADMISSION_ACTION.skip || scope.copy !== null) {
      this.#readAll(children, scope.skipped(node));
    } else {
      this.#readAll(children, scope.refused(node, node.props.id ?? null));
    }
  }

  /** The attributes kept: known and allowed on the tag; $ ones ignored, the rest errors on their attribute. */
  #attributes(
    node: ElementNode,
    scope: ReadScope,
    place: Place,
  ): Record<string, string> {
    const attributes: Record<string, string> = {};

    for (const [name, value] of Object.entries(node.props)) {
      if (name.startsWith(APPLY_PATTERN.readOnlyPrefix)) {
        continue;
      }

      const known = META_ATTRIBUTES.has(name) || CSS_ATTRIBUTES.has(name) || APPLY_PATTERN.mode.test(name);
      const refused = known
        ? this.#parts.refusals.of({
          tag: node.type,
          name,
          value,
          // An existing layer may be a component's: the plugin knows.
          inComponent: scope.inComponent || (scope.copy === null && node.props.id !== undefined),
        })
        : null;

      if (refused !== null) {
        this.#errors.push({ ...place, attribute: name, ...refused });
      } else if (known) {
        attributes[name] = value;
      } else {
        this.#unknown(node, name, value, place);
      }
    }

    return attributes;
  }

  /** An attribute no tag takes: the CSS for one written out of habit, else the nearest spelling. */
  #unknown(
    node: ElementNode,
    name: string,
    value: string,
    place: Place,
  ): void {
    const near = this.#parts.closest.of(name, [...META_ATTRIBUTES, ...CSS_ATTRIBUTES]);
    const hint = this.#habit(name, value) ?? (near === null ? undefined : READ_TEXT.didYouMean(near));

    this.#errors.push({
      ...place,
      attribute: name,
      message: READ_TEXT.notAttribute(name, node.type),
      ...(hint === undefined ? {} : { hint }),
    });
  }

  /** The CSS for an attribute written out of habit ("x" is not "id"), or undefined for any other. */
  #habit(name: string, value: string): string | undefined {
    const habit = Object.hasOwn(HABIT_HINT, name) ? HABIT_HINT[name] : undefined;

    if (habit === undefined) {
      return undefined;
    }

    const trimmed = habit.unit === HABIT_UNIT.pixels ? value.trim() : value;
    const written =
      habit.unit !== HABIT_UNIT.none && APPLY_PATTERN.number.test(trimmed) ? `${trimmed}${habit.unit}` : value;

    return habit.text(written);
  }

  /** The element's id, or new:<line>; new:<line>:<column> when two share a line. */
  #ref(id: string | null, node: ElementNode): string {
    let ref = id ?? READ_REF.onLine(node.line);

    if (this.#refs.has(ref)) {
      ref = READ_REF.atColumn(node.line, node.column);
    }

    this.#refs.add(ref);

    return ref;
  }

  /** Where an element's errors point: its line and column, and the id it names. */
  #place(node: ElementNode, named: string | null): Place {
    return { line: node.line, column: node.column, ...(named === null ? {} : { id: named }) };
  }

  /** The element design_apply works with: its place, layer, ref, parent's ref, position, attributes and content. */
  #elementOf({ node, scope, index, id, ref, source, attributes, content }: ReadElement): ApplyElement {
    return {
      line: node.line,
      column: node.column,
      tag: node.type,
      id,
      ref,
      parent: scope.parentRef ?? scope.skippedParent?.props.id ?? null,
      index,
      attributes,
      ...(content.length > 0 ? { content } : {}),
      ...(scope.copy === null ? {} : { copy: scope.copy.ref }),
      ...(source === null || scope.copy === null ? {} : { source }),
    };
  }
}

/** Where an element's errors point. */
type Place = { readonly line: number; readonly column: number; readonly id?: string };
