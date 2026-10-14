import { withoutUrls } from "../css-mapping/values/css-values.ts";
import { designTree } from "../design/design-xml.ts";
import { attributeOf, type DesignContent, type DesignElement, findElement, joinedContent } from "../design/tree.ts";
import { Color } from "../kernel/color/color.ts";
import { type ColorSpace, colorSpaceOf } from "../kernel/color/color-space.ts";
import { sameValue } from "../kernel/equality.ts";
import type { ApplyElement, LayerNow } from "../types/apply.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import type { XmlChild } from "../types/xml.ts";

/** A layer to compare with an element: the layer, and the parent it sits in. */
type Item = { node: SnapshotNode; parent: SnapshotNode | null };

/** What a render needs besides the layers: the tokens, and the file's colour profile its colours are written in. */
type Tokens = Pick<Snapshot, "styles" | "variables" | "colorProfile">;

/**
 * Which of an element's attributes the layer already has, as design_read would write them (the reader's rounding
 * included), and whether its text is already so: what is left is what design_apply writes. A top-level element is
 * compared with the layer as the read's root and as its parent's child, since design_read writes either; a nested
 * one only as its parent holds it (the root's own size would hide a size that is new). A hidden layer is rendered as
 * shown, so what it has is known when it is shown again.
 */
export function unchangedAttributes(element: ApplyElement, item: Item, tokens: Tokens): LayerNow {
  const renders = rendersOf(element, item, tokens);
  const attributes = new Set<string>();
  const space = colorSpaceOf(tokens.colorProfile);

  for (const [name, given] of Object.entries(element.attributes)) {
    const value = inDocumentSpace(given, space);

    // A file's name depends on where design_read wrote it (folder, -2 suffixes): the server compares the bytes of a
    // file that exists with the layer's image, and swaps it only when they differ.
    if (name === "src" || renders.some((rendered) => same(name, attributeOf(rendered, name), value))) {
      attributes.add(name);
    }
  }

  if (!item.node.visible) {
    // Rendered as shown, but its display is none now: any display given shows it.
    attributes.delete("display");
  }

  const wanted = element.content === undefined ? null : joinedContent(contentOf(element.content));
  // As its parent holds it when it has one: that render places it.
  const shown = renders.at(-1);

  return {
    attributes,
    text:
      wanted === null ||
      renders.some((rendered) => rendered.content !== null && sameValue(joinedContent(rendered.content), wanted)),
    visible: item.node.visible,
    current: Object.fromEntries((shown?.attributes ?? []).filter(([name]) => name !== "id" && !name.startsWith("$"))),
  };
}

/** The elements design_read writes for the layer: as the read's root unless nested, then as its parent holds it. */
function rendersOf(element: ApplyElement, item: Item, tokens: Tokens): DesignElement[] {
  const node = item.node.visible
    ? item.node
    : {
        ...item.node,
        visible: true,
      };
  const nested = element.parent !== null && item.parent !== null;
  const renders = [
    nested
      ? null
      : render(
          {
            root: node,
            ...pick(tokens),
          },
          node.id,
          null,
        ),
    item.parent === null
      ? null
      : render(
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
  ];

  return renders.filter((rendered) => rendered !== null);
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

function pick(tokens: Tokens): Tokens {
  return {
    styles: tokens.styles,
    variables: tokens.variables,
    ...(tokens.colorProfile === undefined ? {} : { colorProfile: tokens.colorProfile }),
  };
}

/** The element design_read writes for a layer in this snapshot; its parent is kept a layout, never an asset. */
function render(snapshot: Snapshot, id: string, layout: string | null): DesignElement | null {
  const { root } = designTree(snapshot, layout === null ? {} : { notAssets: new Set([layout]) });

  return findElement(root, id);
}

/** A Text element's content in the tree's terms, as design_apply writes it: a span's characters with its attributes. */
function contentOf(children: readonly XmlChild[]): DesignContent[] {
  return children.map((child) =>
    child.kind === "text"
      ? {
          kind: "text",
          value: child.value,
        }
      : {
          kind: "span",
          attributes: Object.entries(child.props),
          value: charactersOf(child.children),
        },
  );
}

function charactersOf(children: readonly XmlChild[]): string {
  return children.map((child) => (child.kind === "text" ? child.value : charactersOf(child.children))).join("");
}
