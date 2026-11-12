import type { DesignRead } from "./types.ts";

/** An attribute as design_read writes it: its name and its value, unescaped. */
export type DesignAttribute = readonly [name: string, value: string];

/** A piece of a text's content: plain characters, or a span with what it sets over the text's own. */
export type DesignContent =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "span"; readonly attributes: readonly DesignAttribute[]; readonly value: string };

/** The element design_read writes for one layer: its tag, its attributes in order, its text or its children. */
export interface DesignElement {
  /** The layer's id. */
  readonly id: string;
  readonly tag: string;
  readonly attributes: readonly DesignAttribute[];
  /** A Text's content, piece by piece; null for any other element. */
  readonly content: readonly DesignContent[] | null;
  readonly children: readonly DesignElement[];
}

/** A read as a tree: the root's element (none for a layer that is not shown) and what the read refers to. */
export interface DesignTree extends Omit<DesignRead, "xml"> {
  readonly root: DesignElement | null;
}

/**
 * A text's content as its XML reads back: the characters between two spans in one piece, and no empty piece. A text
 * is built run by run, and runs that read alike are written side by side.
 */
export function joinedContent(content: readonly DesignContent[]): DesignContent[] {
  const joined: DesignContent[] = [];

  for (const piece of content) {
    const last = joined.at(-1);

    if (piece.kind === "text" && last?.kind === "text") {
      joined[joined.length - 1] = {
        kind: "text",
        value: last.value + piece.value,
      };
    } else if (piece.kind === "span" || piece.value !== "") {
      joined.push(piece);
    }
  }

  return joined;
}

/** An attribute's value, when the element has it. */
export function attributeOf(element: DesignElement, name: string): string | undefined {
  return element.attributes.find(([attribute]) => attribute === name)?.[1];
}

/** Every element of the tree, in document order. */
export function elementsOf(root: DesignElement | null): DesignElement[] {
  return root === null ? [] : [root, ...root.children.flatMap((child) => elementsOf(child))];
}

/** An element as a path names it: its tag and name, numbered from the second sibling sharing both, Icon "flask"[2]. */
export function elementLabel(tag: string, name: string | undefined, index: number): string {
  return `${tag} "${name ?? ""}"${index > 0 ? `[${index + 1}]` : ""}`;
}

/** The element written for a layer, anywhere in the tree. */
export function findElement(root: DesignElement | null, id: string): DesignElement | null {
  return elementsOf(root).find((element) => element.id === id) ?? null;
}
