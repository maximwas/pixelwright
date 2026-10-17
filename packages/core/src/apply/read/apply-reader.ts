import { CSS_ATTRIBUTES } from "../../css-mapping/vocabulary.ts";
import type { XmlChild, XmlElementNode } from "../../types/xml.ts";
import { closest } from "../../utils/closest.ts";
import type { ApplyElement, ApplyError, ContentPiece } from "../types.ts";
import { META_ATTRIBUTES } from "../vocabulary.ts";
import { type Admission, admissionOf } from "./admission.ts";
import { refusalOf } from "./attribute-refusals.ts";
import { habitHint } from "./habits.ts";
import { childScope, refusedScope, type Scope, skippedScope, TOP } from "./scope.ts";
import { piecesOf } from "./text-pieces.ts";

/** Where an element's errors point: its line and column, and the id it names. */
type Place = { readonly line: number; readonly column: number; readonly id?: string };

/**
 * Reads design_apply's XML into elements in document order, collecting the errors: each element is admitted (or
 * turned away with its children read as the admission says), its attributes kept or refused, its text read as pieces.
 */
export class ApplyReader {
  readonly elements: ApplyElement[] = [];
  readonly errors: ApplyError[] = [];
  /** The refs given so far: unique in the call. */
  readonly #refs = new Set<string>();
  /** The ids named so far outside copies. */
  readonly #ids = new Set<string>();

  read(nodes: readonly XmlChild[], scope: Scope = TOP): void {
    let index = 0;

    for (const node of nodes) {
      if (node.kind === "text") {
        this.errors.push({
          line: node.line,
          column: node.column,
          message: `Text "${node.value.slice(0, 30)}" outside a <Text>: text belongs in a Text element.`,
        });
        continue;
      }

      this.#element(node, scope, index);
      index += 1;
    }
  }

  #element(node: XmlElementNode, scope: Scope, index: number): void {
    const named = node.props.id ?? null;
    // Inside a copy an id names the source's layer: the element writes its copy, a layer of its own.
    const source = scope.copy === null ? null : named;
    const id = source === null ? named : null;
    const place = placeOf(node, named);
    const admission = admissionOf({
      node,
      scope,
      named,
      source,
      id,
      seen: scope.copy === null ? this.#ids : scope.copy.seen,
    });

    if (admission !== null) {
      this.#turnAway(node, scope, place, admission);

      return;
    }

    const ref = this.#ref(id, node);
    const attributes = this.#attributes(node, scope, place);
    // No content leaves the text as it is: a partial edit (<Text id="…" color="…"/>) never empties it, and a text
    // design_read shortened to fit maxChars is never written back shortened.
    const content = node.type === "Text" && node.props.$truncated !== "true" ? piecesOf(node, this.errors) : [];

    this.elements.push(
      elementOf({
        node,
        scope,
        index,
        id,
        ref,
        source,
        attributes,
        content,
      }),
    );

    if (node.type !== "Text") {
      this.read(
        node.children,
        childScope(scope, {
          ref,
          tag: node.type,
          creating: id === null && source === null,
          copying: attributes.copyOf !== undefined,
        }),
      );
    }
  }

  /** An element not read: its error, then its children as the admission says. */
  #turnAway(node: XmlElementNode, scope: Scope, place: Place, admission: Admission): void {
    this.errors.push({
      ...place,
      message: admission.message,
      ...(admission.hint === undefined ? {} : { hint: admission.hint }),
    });

    // A text's or a span's own characters are its content, not layers: only the elements in it are read.
    const children =
      node.type === "Text" || node.type === "Span"
        ? node.children.filter(({ kind }) => kind === "element")
        : node.children;

    // Inside a copy a refused element's id names the source's layer: a new layer under it would land in the original.
    if (admission.action === "skip" || scope.copy !== null) {
      this.read(children, skippedScope(scope, node));
    } else {
      this.read(children, refusedScope(scope, node, node.props.id ?? null));
    }
  }

  /** The attributes kept: known and allowed on the tag; \$ ones ignored, the rest errors on their attribute. */
  #attributes(node: XmlElementNode, scope: Scope, place: Place): Record<string, string> {
    const attributes: Record<string, string> = {};

    for (const [name, value] of Object.entries(node.props)) {
      if (name.startsWith("$")) {
        continue;
      }

      const known = META_ATTRIBUTES.has(name) || CSS_ATTRIBUTES.has(name);
      const refused = known
        ? refusalOf({
            tag: node.type,
            name,
            value,
            inComponent: scope.inComponent,
          })
        : null;

      if (refused !== null) {
        this.errors.push({
          ...place,
          attribute: name,
          ...refused,
        });
      } else if (known) {
        attributes[name] = value;
      } else {
        this.#unknown(node, name, value, place);
      }
    }

    return attributes;
  }

  /** An attribute no tag takes: the CSS for one written out of habit, else the nearest spelling. */
  #unknown(node: XmlElementNode, name: string, value: string, place: Place): void {
    const near = closest(name, [...META_ATTRIBUTES, ...CSS_ATTRIBUTES]);
    const hint = habitHint(name, value) ?? (near === null ? undefined : `Did you mean ${near}?`);

    this.errors.push({
      ...place,
      attribute: name,
      message: `${name} is not an attribute of <${node.type}>: left out.`,
      ...(hint === undefined ? {} : { hint }),
    });
  }

  /** The element's id, or new:<line>; new:<line>:<column> when two share a line. */
  #ref(id: string | null, node: XmlElementNode): string {
    let ref = id ?? `new:${node.line}`;

    if (this.#refs.has(ref)) {
      ref = `new:${node.line}:${node.column}`;
    }

    this.#refs.add(ref);

    return ref;
  }
}

/** Where an element's errors point. */
function placeOf(node: XmlElementNode, named: string | null): Place {
  return {
    line: node.line,
    column: node.column,
    ...(named === null ? {} : { id: named }),
  };
}

/** An element read, with what the reader worked out for it. */
interface ReadElement {
  readonly node: XmlElementNode;
  readonly scope: Scope;
  readonly index: number;
  readonly id: string | null;
  readonly ref: string;
  readonly source: string | null;
  readonly attributes: Record<string, string>;
  readonly content: ContentPiece[];
}

/** The element design_apply works with: its place, layer, ref, parent's ref, position, attributes and content. */
function elementOf({ node, scope, index, id, ref, source, attributes, content }: ReadElement): ApplyElement {
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
    ...(source === null || scope.copy === null
      ? {}
      : {
          source,
          copy: scope.copy.ref,
        }),
  };
}
