import { withoutUrls } from "../css-mapping/values/css-values.ts";
import { designXml } from "../design/design-xml.ts";
import { Color } from "../kernel/color/color.ts";
import { type ColorSpace, colorSpaceOf } from "../kernel/color/color-space.ts";
import type { ApplyElement, LayerNow } from "../types/apply.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import type { XmlChild, XmlElementNode } from "../types/xml.ts";
import { parseXml } from "../xml/parse/parse-xml.ts";

/**
 * Which of an element's attributes the layer already has, as design_read would write them (the reader's rounding
 * included), and whether its text is already so: what is left is what design_apply writes. A top-level element is
 * compared with the layer as the read's root and as its parent's child, since design_read writes either; a nested
 * one only as its parent holds it (the root's own size would hide a size that is new). A hidden layer is rendered as
 * shown, so what it has is known when it is shown again.
 */
export function unchangedAttributes(
  element: ApplyElement,
  item: { node: SnapshotNode; parent: SnapshotNode | null },
  tokens: Pick<Snapshot, "styles" | "variables" | "colorProfile">,
): LayerNow {
  const node = item.node.visible
    ? item.node
    : {
        ...item.node,
        visible: true,
      };
  const nested = element.parent !== null && item.parent !== null;
  const renders: (XmlElementNode | null)[] = [];

  if (!nested) {
    renders.push(
      render(
        {
          root: node,
          ...pick(tokens),
        },
        node.id,
        null,
      ),
    );
  }

  if (item.parent !== null) {
    renders.push(
      render(
        {
          root: {
            ...item.parent,
            children: [node],
          },
          ...pick(tokens),
        },
        node.id,
        item.parent.id,
      ),
    );
  }

  const attributes = new Set<string>();
  const space = colorSpaceOf(tokens.colorProfile);

  for (const [name, given] of Object.entries(element.attributes)) {
    const value = inDocumentSpace(given, space);

    // A file's name depends on where design_read wrote it (folder, -2 suffixes): the server compares the bytes of a
    // file that exists with the layer's image, and swaps it only when they differ.
    if (name === "src" || renders.some((rendered) => same(name, rendered?.props[name], value))) {
      attributes.add(name);
    }
  }

  if (!item.node.visible) {
    // Rendered as shown, but its display is none now: any display given shows it.
    attributes.delete("display");
  }

  // As its parent holds it when it has one: that render places it.
  const shown = renders.findLast((rendered) => rendered !== null);

  const wanted = element.content === undefined ? null : canonical(element.content);

  return {
    attributes,
    text: wanted === null || renders.some((rendered) => rendered !== null && canonical(rendered.children) === wanted),
    visible: item.node.visible,
    current: Object.fromEntries(
      Object.entries(shown?.props ?? {}).filter(([name]) => name !== "id" && !name.startsWith("$")),
    ),
  };
}

/**
 * A value with its sRGB colours (hex, rgb()) as a Display P3 file holds and design_read writes them, so a colour the
 * layer already has compares equal; an sRGB file's values are as given.
 */
function inDocumentSpace(value: string, space: ColorSpace): string {
  if (space === "srgb") {
    return value;
  }

  return value.replace(/#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)/g, (literal) => {
    const color = Color.parse(literal);

    return color === null ? literal : color.to(space).css();
  });
}

/** Equal as design_read writes it; an image's file name aside, which depends on where the read wrote it. */
function same(name: string, written: string | undefined, value: string): boolean {
  return (
    written === value || (written !== undefined && name === "background" && withoutUrls(written) === withoutUrls(value))
  );
}

/** What a render needs besides the layers: the tokens, and the file's colour profile its colours are written in. */
function pick(
  tokens: Pick<Snapshot, "styles" | "variables" | "colorProfile">,
): Pick<Snapshot, "styles" | "variables" | "colorProfile"> {
  return {
    styles: tokens.styles,
    variables: tokens.variables,
    ...(tokens.colorProfile === undefined ? {} : { colorProfile: tokens.colorProfile }),
  };
}

/** The element design_read writes for a layer in this snapshot; its parent is kept a layout, never an asset. */
function render(snapshot: Snapshot, id: string, layout: string | null): XmlElementNode | null {
  const { xml } = designXml(snapshot, layout === null ? {} : { notAssets: new Set([layout]) });

  return find(parseXml(xml), id);
}

function find(nodes: readonly XmlChild[], id: string): XmlElementNode | null {
  for (const node of nodes) {
    if (node.kind === "element") {
      if (node.props.id === id) {
        return node;
      }

      const inside = find(node.children, id);

      if (inside !== null) {
        return inside;
      }
    }
  }

  return null;
}

/** A text's content in one comparable form: text values and spans with their attributes, positions left out. */
function canonical(children: readonly XmlChild[]): string {
  return JSON.stringify(
    children.map((child) =>
      child.kind === "text"
        ? child.value
        : {
            span: child.props,
            text: canonical(child.children),
          },
    ),
  );
}
