import { BridgeError } from "../bridge/protocol.ts";
import {
  BOX_PAINT,
  CSS_ATTRIBUTES,
  LAYOUT_ATTRIBUTES,
  LAYOUT_TAGS,
  SPAN_ATTRIBUTES,
  TEXT_ATTRIBUTES,
} from "../css-mapping/vocabulary.ts";
import type { XmlChild, XmlElementNode, XmlLocation } from "../types/xml.ts";
import { closest } from "../utils/closest.ts";
import { parseXml } from "../xml/parse/parse-xml.ts";
import type { ApplyElement, ApplyError, ContentPiece } from "./types.ts";
import { CREATABLE_TAGS, KNOWN_TAGS, LAYER_ID, META_ATTRIBUTES, SHAPE_TAGS, UNDRAWN_TAGS } from "./vocabulary.ts";

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

  reader.children(roots);

  return {
    elements: reader.elements,
    errors: reader.errors,
  };
}

/** Where an element sits while reading: its parent, a copy it is in, a new component it is in. */
interface Scope {
  /** The parent element's ref, applied. */
  readonly parentRef: string | null;
  /** A parent that was not applied: an existing one (with id) still holds layers, a new one holds nothing. */
  readonly skippedParent: XmlElementNode | null;
  /**
   * Inside a copy (copyOf) or a new instance: its ref, and the layers named there so far, each once; ids there name
   * the source's layers (or another instance's of the component), written onto their counterparts.
   */
  readonly copy: { readonly ref: string; readonly seen: Set<string> } | null;
  /** Inside a new Component: its layers may make properties (prop, visibleProp). */
  readonly inComponent: boolean;
}

const TOP: Scope = {
  parentRef: null,
  skippedParent: null,
  copy: null,
  inComponent: false,
};

class ApplyReader {
  readonly elements: ApplyElement[] = [];
  readonly errors: ApplyError[] = [];
  readonly #refs = new Set<string>();
  readonly #ids = new Set<string>();

  children(nodes: readonly XmlChild[], scope: Scope = TOP): void {
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

      this.element(node, scope, index);
      index += 1;
    }
  }

  element(node: XmlElementNode, scope: Scope, index: number): void {
    const named = node.props.id ?? null;
    // Inside a copy an id names the source's layer: the element writes its copy, a layer of its own.
    const source = scope.copy === null ? null : named;
    const id = source === null ? named : null;
    const where = {
      line: node.line,
      column: node.column,
      ...(named === null ? {} : { id: named }),
    };
    const skip = (message: string, hint?: string) => {
      this.errors.push({
        ...where,
        message,
        ...(hint === undefined ? {} : { hint }),
      });
      // Its children with ids are layers of their own; new ones would land in the wrong layer.
      this.children(node.children, {
        ...scope,
        parentRef: null,
        skippedParent: {
          ...node,
          props: Object.fromEntries(Object.entries(node.props).filter(([name]) => name !== "id")),
        },
      });
    };
    const refuse = (message: string, hint?: string) => {
      this.errors.push({
        ...where,
        message,
        ...(hint === undefined ? {} : { hint }),
      });
      // Children with ids are layers of their own; new ones need this element to be made first.
      this.children(node.children, {
        ...scope,
        parentRef: id,
        skippedParent: node,
      });
    };

    if (scope.skippedParent !== null && id === null && scope.skippedParent.props.id === undefined) {
      this.errors.push({
        ...where,
        message: `<${node.type}> is not created: its parent <${scope.skippedParent.type}> at line ${scope.skippedParent.line} was not applied.`,
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

    if (named !== null && !LAYER_ID.test(named)) {
      skip(`id="${named}" is not a Figma layer id (like 54:243): a new layer has no id.`);

      return;
    }

    if (named !== null && node.props.copyOf !== undefined) {
      skip(`A copy is a new layer: an element with copyOf has no id (${named}).`);

      return;
    }

    const seen = scope.copy === null ? this.#ids : scope.copy.seen;

    if (named !== null && seen.has(named)) {
      skip(
        source === null
          ? `id ${named} is given twice: a new layer has no id, so copy an element without its ids.`
          : `${named} is named twice in one copy: each of the source's layers has one element.`,
      );

      return;
    }

    if (named !== null) {
      seen.add(named);
    }

    const creating = id === null && source === null;
    const missing = creating ? missingFor(node) : null;

    if (missing !== null) {
      refuse(missing.message, missing.hint);

      return;
    }

    const ref = this.#ref(id, node);
    const attributes: Record<string, string> = {};

    for (const [name, value] of Object.entries(node.props)) {
      if (name.startsWith("$")) {
        continue;
      }

      const known = META_ATTRIBUTES.has(name) || CSS_ATTRIBUTES.has(name);
      const refused = known ? refusalOf(node.type, name, value, scope.inComponent) : null;

      if (refused !== null) {
        this.errors.push({
          ...where,
          attribute: name,
          ...refused,
        });
      } else if (known) {
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
    });

    if (!isText) {
      this.children(node.children, {
        parentRef: ref,
        skippedParent: null,
        // A copy's or a new instance's ids are its own layers' counterparts.
        copy:
          attributes.copyOf !== undefined || (creating && node.type === "Instance")
            ? {
                ref,
                seen: new Set(),
              }
            : scope.copy,
        inComponent: scope.inComponent || (creating && node.type === "Component"),
      });
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

  /**
   * A Text's content as pieces: its characters, and its Spans' with the run attributes they set (a nested span's
   * characters belong to the span that holds it).
   */
  #content(node: XmlElementNode): ContentPiece[] {
    const content: ContentPiece[] = [];

    for (const child of node.children) {
      if (child.kind === "text") {
        content.push({
          line: child.line,
          column: child.column,
          kind: "text",
          value: child.value,
        });
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
          line: child.line,
          column: child.column,
          kind: "span",
          attributes: Object.fromEntries(Object.entries(child.props).filter(([name]) => SPAN_ATTRIBUTES.has(name))),
          value: charactersOf(child.children),
        });
      }
    }

    return content;
  }
}

/** What a new layer of this tag cannot be made without; null when it has it or is a copy. */
function missingFor(node: XmlElementNode): { message: string; hint?: string } | null {
  if (node.props.copyOf !== undefined) {
    return null;
  }

  if (!CREATABLE_TAGS.has(node.type)) {
    return node.type === "Group"
      ? {
          message: "A group is made by grouping layers in Figma.",
          hint: "Create a <Frame> instead, or change the group by its id.",
        }
      : UNDRAWN_TAGS.has(node.type)
        ? {
            message: `A <${node.type}> is not drawn from XML.`,
            hint: 'Draw it as an <Icon src="…svg">, or change it by its id.',
          }
        : { message: `<${node.type}> cannot be created.` };
  }

  if (node.type === "Instance" && node.props.component === undefined) {
    return {
      message: "An <Instance> is made from a component.",
      hint: 'Give component="Name" and variant="Property=Value"; components_read lists them.',
    };
  }

  if ((node.type === "Image" || node.type === "Icon") && node.props.src === undefined) {
    return {
      message: `An <${node.type}> is made from a file: give it src.`,
      hint: `Give src="path/to/file${node.type === "Icon" ? ".svg" : ".png"}".`,
    };
  }

  return null;
}

/** Why a tag cannot take an attribute, with what to write instead; null when it can. */
function refusalOf(
  tag: string,
  name: string,
  value: string,
  inComponent: boolean,
): { message: string; hint: string } | null {
  const layout = LAYOUT_TAGS.has(tag);

  if ((name === "prop" || name === "visibleProp") && !inComponent) {
    return {
      message: `${name} makes a property of a new <Component>: this layer is in none.`,
      hint: "Use it on the layers inside a <Component> you create.",
    };
  }

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

/** The characters of a span's content, a nested span's included. */
function charactersOf(children: readonly XmlChild[]): string {
  return children.map((child) => (child.kind === "text" ? child.value : charactersOf(child.children))).join("");
}
