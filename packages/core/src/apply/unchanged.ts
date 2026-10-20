import { withoutUrls } from "../css-mapping/values/css-values.ts";
import type { LayerNow } from "../css-mapping/write-element.ts";
import { type LayerInParent, type LayerTokens, layerRead } from "../design/layer-read.ts";
import { attributeOf, type DesignContent, type DesignElement, joinedContent } from "../design/tree.ts";
import { Color } from "../kernel/color/color.ts";
import { type ColorSpace, colorSpaceOf } from "../kernel/color/color-space.ts";
import { sameValue } from "../kernel/equality.ts";
import type { ApplyElement, ContentPiece } from "./types.ts";

/**
 * Which of an element's attributes the layer already has, as design_read would write them (the reader's rounding
 * included), and whether its text is already so: what is left is what design_apply writes. A top-level element is
 * compared with the layer as the read's root and as its parent's child, since design_read writes either; a nested
 * one only as its parent holds it (the root's own size would hide a size that is new). A hidden layer is rendered as
 * shown, so what it has is known when it is shown again.
 */
export function unchangedAttributes(element: ApplyElement, item: LayerInParent, tokens: LayerTokens): LayerNow {
  const renders = rendersOf(element, item, tokens);
  const attributes = new Set<string>();
  const space = colorSpaceOf(tokens.colorProfile);

  for (const [name, given] of Object.entries(element.attributes)) {
    // As typed, or with its sRGB colours in the file's space: a name or a note that reads like a hex is no colour.
    const values = [given, inDocumentSpace(given, space)];

    // A file's name depends on where design_read wrote it (folder, -2 suffixes): the server compares the bytes of a
    // file that exists with the layer's image, and swaps it only when they differ.
    if (
      name === "src" ||
      renders.some((rendered) =>
        values.some((value) => same(name, attributeOf(rendered, READ_AS[name] ?? name), value)),
      )
    ) {
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

/** The read-only attribute design_read writes what a component's layer is bound to as. */
const READ_AS: Readonly<Record<string, string>> = {
  prop: "$prop",
  visibleProp: "$visibleProp",
  swapProp: "$swapProp",
};

/** The elements design_read writes for the layer: as the read's root unless nested, then as its parent holds it. */
function rendersOf(element: ApplyElement, item: LayerInParent, tokens: LayerTokens): DesignElement[] {
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
      : layerRead(
          {
            node,
            parent: null,
          },
          tokens,
        ).element,
    item.parent === null
      ? null
      : layerRead(
          {
            node,
            parent: item.parent,
          },
          tokens,
        ).element,
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

/** A Text element's content in the tree's terms, as design_apply writes it: a span's characters with its attributes. */
function contentOf(pieces: readonly ContentPiece[]): DesignContent[] {
  return pieces.map((piece) =>
    piece.kind === "text"
      ? {
          kind: "text",
          value: piece.value,
        }
      : {
          kind: "span",
          attributes: Object.entries(piece.attributes),
          value: piece.value,
        },
  );
}
