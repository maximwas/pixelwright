import type { ApplyElement, LayerNow } from "../types/apply.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import type { XmlChild, XmlElementNode } from "../types/xml.ts";
import { designXml } from "../xml/design.ts";
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
  tokens: Pick<Snapshot, "styles" | "variables">,
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

  for (const [name, value] of Object.entries(element.attributes)) {
    // An asset's file name depends on where design_read wrote it; a file is replaced in stage 4b.
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

/** Equal as design_read writes it; an image's file name aside, which depends on where the read wrote it. */
function same(name: string, written: string | undefined, value: string): boolean {
  const file = (css: string) => css.replace(/url\([^)]*\)/g, "url()");

  return written === value || (written !== undefined && name === "background" && file(written) === file(value));
}

function pick(tokens: Pick<Snapshot, "styles" | "variables">): Pick<Snapshot, "styles" | "variables"> {
  return {
    styles: tokens.styles,
    variables: tokens.variables,
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
