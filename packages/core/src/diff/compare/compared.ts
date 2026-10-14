import { designTree } from "../../design/design-xml.ts";
import { type DesignElement, joinedContent } from "../../design/tree.ts";
import type { Snapshot } from "../../types/snapshot.ts";

/** A layer as a diff compares it, or a run of a text's (a span, with no id): its layers or runs are its children. */
export interface Compared {
  readonly id: string;
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** A text's characters outside its spans; null when it has none. */
  readonly text: string | null;
  readonly children: readonly Compared[];
}

/** The element design_read writes for a snapshot's root, as a diff compares it. */
export function comparedRoot(snapshot: Snapshot): Compared {
  const { root } = designTree(snapshot);

  if (root === null) {
    throw new Error("design_read wrote no element for the layer");
  }

  return comparedOf(root);
}

/** An element as a diff compares it: a text's spans become its children, in order. */
export function comparedOf(element: DesignElement): Compared {
  const content = joinedContent(element.content ?? []);
  const texts = content.flatMap((piece) => (piece.kind === "text" ? [piece.value] : []));
  const spans = content.flatMap((piece) =>
    piece.kind === "span"
      ? [
          {
            id: "",
            tag: "Span",
            attributes: Object.fromEntries(piece.attributes),
            text: piece.value === "" ? null : piece.value,
            children: [],
          },
        ]
      : [],
  );

  return {
    id: element.id,
    tag: element.tag,
    attributes: Object.fromEntries(element.attributes),
    text: texts.length === 0 ? null : texts.join(""),
    children: [...element.children.map(comparedOf), ...spans],
  };
}

/** An element as nodes_diff names it: its tag and name, numbered when siblings share both. */
export function labelOf(element: Compared, index: number): string {
  return `${element.tag} "${element.attributes.name ?? ""}"${index > 0 ? `[${index + 1}]` : ""}`;
}
