import { BridgeError } from "../bridge/protocol.ts";
import {
  BOX_PAINT,
  CREATABLE_TAGS,
  CSS_ATTRIBUTES,
  KNOWN_TAGS,
  LATER_TAGS,
  LAYER_ID,
  LAYOUT_ATTRIBUTES,
  LAYOUT_TAGS,
  META_ATTRIBUTES,
  SHAPE_TAGS,
  SPAN_ATTRIBUTES,
  TEXT_ATTRIBUTES,
} from "../constants/apply.ts";
import type { ApplyElement, ApplyError } from "../types/apply.ts";
import type { XmlChild, XmlElementNode, XmlLocation } from "../types/xml.ts";
import { closest } from "../utils/closest.ts";
import { parseXml } from "../xml/parse/parse-xml.ts";

/**
 * A design_apply XML as a flat list of elements in document order, each with its parent's ref and its attributes,
 * and the errors: a parse error (nothing else then), an unknown tag (skipped, children with ids still read), an id
 * given twice or not a Figma id (skipped: a copy must not write into the original), an unknown attribute or one the
 * tag cannot take (left out, the element kept), a create that comes in stage 4b. `$` attributes are ignored, and a
 * text design_read shortened ($truncated) is left as it is.
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
  readonly #ids = new Set<string>();

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

    if (id !== null && (this.#ids.has(id) || !LAYER_ID.test(id))) {
      this.errors.push({
        ...where,
        message: this.#ids.has(id)
          ? `id ${id} is given twice: a new layer has no id, so copy an element without its ids.`
          : `id="${id}" is not a Figma layer id (like 2:4869): a new layer has no id.`,
      });
      // Its children with ids are layers of their own; new ones would land in the wrong layer.
      this.children(node.children, null, {
        ...node,
        props: Object.fromEntries(Object.entries(node.props).filter(([name]) => name !== "id")),
      });

      return;
    }

    if (id !== null) {
      this.#ids.add(id);
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

      const refused = META_ATTRIBUTES.has(name) || CSS_ATTRIBUTES.has(name) ? refusalOf(node.type, name, value) : null;

      if (refused !== null) {
        this.errors.push({
          ...where,
          attribute: name,
          ...refused,
        });
      } else if (META_ATTRIBUTES.has(name) || CSS_ATTRIBUTES.has(name)) {
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
    // No content leaves the text as it is: a partial edit (<Text id="…" color="…"/>) never empties it, and a text
    // design_read shortened to fit maxChars is never written back shortened.
    const content = isText && node.props.$truncated !== "true" ? this.#content(node) : [];

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

/** Why a tag cannot take an attribute, with what to write instead; null when it can. */
function refusalOf(tag: string, name: string, value: string): { message: string; hint: string } | null {
  const layout = LAYOUT_TAGS.has(tag);

  if (name === "display" && !layout && value !== "none" && value !== "block") {
    return {
      message: `A <${tag}> has no auto layout: display takes none (hidden) or block here.`,
      hint: 'Put the layers in a <Frame display="flex">.',
    };
  }

  if (LAYOUT_ATTRIBUTES.has(name) && !layout) {
    return {
      message: `${name} lays out a frame's children: a <${tag}> has none.`,
      hint: 'Put the layers in a <Frame display="flex"> and give it there.',
    };
  }

  if (TEXT_ATTRIBUTES.has(name) && tag !== "Text") {
    return {
      message: `${name} styles a text: a <${tag}> holds none.`,
      hint: "Give it on the <Text> inside.",
    };
  }

  if (tag === "Text" && BOX_PAINT.has(name)) {
    return {
      message: `A <Text> has no box to paint: ${name} is not written on it.`,
      hint:
        name === "background"
          ? "A text's colour is color; a background goes on a <Frame> around it."
          : name === "box-shadow"
            ? "A text's shadow is text-shadow."
            : "Put the text in a <Frame> and give it there.",
    };
  }

  if ((tag === "Line" || tag === "Group") && BOX_PAINT.has(name) && !(tag === "Line" && name.startsWith("border"))) {
    return {
      message: `A <${tag}> has no ${name}.`,
      hint: tag === "Line" ? "A line is drawn by its border-top (or border-left when it stands)." : "Paint its layers.",
    };
  }

  if (name === "overflow" && SHAPE_TAGS.has(tag)) {
    return {
      message: `A <${tag}> holds no layers to clip.`,
      hint: "overflow clips a frame's content.",
    };
  }

  return null;
}
