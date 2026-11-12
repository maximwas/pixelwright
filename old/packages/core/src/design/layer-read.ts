import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import { designTree } from "./design-xml.ts";
import { type DesignElement, findElement } from "./tree.ts";

/** A layer and the parent it sits in; none for a layer read as a read's root. */
export interface LayerInParent {
  readonly node: SnapshotNode;
  readonly parent: SnapshotNode | null;
}

/** What a read of a layer needs besides it: the tokens, and the file's colour profile its colours are written in. */
export type LayerTokens = Pick<Snapshot, "styles" | "variables" | "colorProfile">;

/** A layer's element as design_read writes it, with the tokens and text styles that read names. */
export interface LayerRead {
  readonly element: DesignElement | null;
  readonly tokens: Record<string, string>;
  readonly textStyles: Record<string, string>;
}

/**
 * A layer as design_read writes it: as its parent holds it when it has one (the parent alone around it, kept a layout
 * and never taken for an asset), else as a read's root. Its element is null when it is not shown.
 */
export function layerRead(
  { node, parent }: LayerInParent,
  { styles, variables, colorProfile }: LayerTokens,
): LayerRead {
  const tree = designTree(
    {
      root:
        parent === null
          ? node
          : {
              ...parent,
              children: [node],
            },
      styles,
      variables,
      ...(colorProfile === undefined ? {} : { colorProfile }),
    },
    parent === null ? {} : { notAssets: new Set([parent.id]) },
  );

  return {
    element: findElement(tree.root, node.id),
    tokens: tree.tokens,
    textStyles: tree.textStyles,
  };
}
