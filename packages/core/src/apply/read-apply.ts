import { BridgeError } from "../bridge/protocol.ts";
import {
  CREATABLE_TAGS,
  CSS_ATTRIBUTES,
  KNOWN_TAGS,
  LATER_TAGS,
  META_ATTRIBUTES,
  SPAN_ATTRIBUTES,
} from "../constants/apply.ts";
import type { ApplyElement, ApplyError } from "../types/apply.ts";
import type { XmlChild, XmlElementNode, XmlLocation } from "../types/xml.ts";
import { closest } from "../utils/closest.ts";
import { parseXml } from "../xml/parse/parse-xml.ts";

/**
 * A design_apply XML as a flat list of elements in document order, each with its parent's ref and its attributes,
 * and the errors: a parse error (nothing else then), an unknown tag (skipped, children with ids still read), an
 * unknown attribute (left out, the element kept), a create that comes in stage 4b. `$` attributes are ignored.
 */
export function readApply(xml: string): { elements: ApplyElement[]; errors: ApplyError[] } {
  let roots: XmlChild[];

  try {
    roots = parseXml(xml);
  } catch (error) {
    if (error instanceof BridgeError && error.code === "INVALID_XML") {
      const at = error.data as XmlLocation | null;

      return {
        elements: [],
        errors: [
          {
            line: at?.line ?? 1,
            column: at?.column ?? 1,
            message: error.message,
          },
        ],
      };
    }

    throw error;
  }

  const reader = new ApplyReader();

  reader.children(roots, null, null);

  return {
    elements: reader.elements,
    errors: reader.errors,
  };
}

class ApplyReader {
  readonly elements: ApplyElement[] = [];
  readonly errors: ApplyError[] = [];
  readonly #refs = new Set<string>();

  /** The elements among `nodes`, under a parent that is applied (ref), skipped but existing (id), or skipped and new. */
  children(nodes: readonly XmlChild[], parentRef: string | null, skippedParent: XmlElementNode | null): void {
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

      this.element(node, parentRef, skippedParent, index);
      index += 1;
    }
  }

  element(node: XmlElementNode, parentRef: string | null, skippedParent: XmlElementNode | null, index: number): void {
    const id = node.props.id ?? null;
    const where = {
      line: node.line,
      column: node.column,
      ...(id === null ? {} : { id }),
    };
    const refuse = (message: string, hint?: string) => {
      this.errors.push({
        ...where,
        message,
        ...(hint === undefined ? {} : { hint }),
      });
      // Children with ids are layers of their own; new ones need this element to be made first.
      this.children(node.children, id, node);
    };

    if (skippedParent !== null && id === null && skippedParent.props.id === undefined) {
      this.errors.push({
        ...where,
        message: `<${node.type}> is not created: its parent <${skippedParent.type}> at line ${skippedParent.line} was not applied.`,
      });

      return;
    }

    if (node.type === "Span") {
      this.errors.push({
        ...where,
        message: "A <Span> belongs inside a Text: it is a run of the text's characters.",
      });

      return;
    }

    if (!KNOWN_TAGS.has(node.type)) {
      const near = closest(node.type, KNOWN_TAGS);

      refuse(
        `<${node.type}> is not a Pixelwright tag.`,
        near === null ? "Tags are Figma layer types: Frame, Text, Rectangle…" : `Did you mean <${near}>?`,
      );

      return;
    }

    if (id === null && !CREATABLE_TAGS.has(node.type)) {
      refuse(
        LATER_TAGS.has(node.type)
          ? `Creating <${node.type}> is not available yet (components, images and vectors come next): change existing ones by id.`
          : `<${node.type}> cannot be created.`,
      );

      return;
    }

    const ref = this.#ref(id, node);
    const attributes: Record<string, string> = {};

    for (const [name, value] of Object.entries(node.props)) {
      if (name.startsWith("$")) {
        continue;
      }

      if (META_ATTRIBUTES.has(name) || CSS_ATTRIBUTES.has(name)) {
        attributes[name] = value;
      } else {
        const near = closest(name, [...META_ATTRIBUTES, ...CSS_ATTRIBUTES]);

        this.errors.push({
          ...where,
          attribute: name,
          message: `${name} is not an attribute of <${node.type}>: left out.`,
          ...(near === null ? {} : { hint: `Did you mean ${near}?` }),
        });
      }
    }

    const isText = node.type === "Text";
    // No content leaves the text as it is: a partial edit (<Text id="…" color="…"/>) never empties it.
    const content = isText ? this.#content(node) : [];

    this.elements.push({
      line: node.line,
      column: node.column,
      tag: node.type,
      id,
      ref,
      parent: parentRef ?? skippedParent?.props.id ?? null,
      index,
      attributes,
      ...(content.length > 0 ? { content } : {}),
    });

    if (!isText) {
      this.children(node.children, ref, null);
    }
  }

  #ref(id: string | null, node: XmlElementNode): string {
    let ref = id ?? `new:${node.line}`;

    if (this.#refs.has(ref)) {
      ref = `new:${node.line}:${node.column}`;
    }

    this.#refs.add(ref);

    return ref;
  }

  /** A Text's runs: text, and Spans holding text and run attributes only. */
  #content(node: XmlElementNode): XmlChild[] {
    const content: XmlChild[] = [];

    for (const child of node.children) {
      if (child.kind === "text") {
        content.push(child);
      } else if (child.type !== "Span") {
        this.errors.push({
          line: child.line,
          column: child.column,
          message: `<${child.type}> inside a Text: a text holds only text and <Span> runs.`,
        });
      } else {
        for (const name of Object.keys(child.props)) {
          if (!SPAN_ATTRIBUTES.has(name)) {
            this.errors.push({
              line: child.line,
              column: child.column,
              attribute: name,
              message: `${name} is not an attribute of <Span>: left out.`,
            });
          }
        }

        content.push({
          ...child,
          props: Object.fromEntries(Object.entries(child.props).filter(([name]) => SPAN_ATTRIBUTES.has(name))),
        });
      }
    }

    return content;
  }
}
