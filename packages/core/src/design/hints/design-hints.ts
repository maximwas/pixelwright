import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import { classify } from "../assets/classify.ts";
import { designTree } from "../design-xml.ts";
import type { DesignTree } from "../tree.ts";
import { inferredHints } from "./inferred-hints.ts";
import { defaultNameHints, layerHints, missingFontHints, type ShownLayer } from "./layer-hints.ts";
import { tokenHints } from "./token-hints.ts";

/**
 * What Figma does not bind and the code should: raw values equal to tokens, unnamed layers, frames placed by hand,
 * backgrounds drawn as rectangles, bare wrappers, missing fonts, detached components. Hints never change the XML.
 */
export function designHints(
  snapshot: Snapshot,
  read: Pick<DesignTree, "root" | "tokens"> = designTree(snapshot),
): string[] {
  const layers = shownLayers(snapshot);
  const nodes = layers.map(({ node }) => node);

  return [
    ...tokenHints(snapshot, read),
    ...defaultNameHints(nodes),
    ...layerHints(layers, snapshot.root),
    ...missingFontHints(nodes),
    ...inferredHints(snapshot, nodes),
  ];
}

/**
 * Every visible layer of the snapshot that is no asset, in document order: hints speak of the design, branches the read
 * cut to fit included; an asset is one file, and how it is built never reaches the code.
 */
function shownLayers(snapshot: Snapshot): ShownLayer[] {
  const layers: ShownLayer[] = [];
  const walk = (node: SnapshotNode, parent: SnapshotNode | null) => {
    if (!node.visible || classify(node, snapshot.root) !== null) {
      return;
    }

    layers.push({
      node,
      parent,
    });

    for (const child of node.children ?? []) {
      walk(child, node);
    }
  };

  walk(snapshot.root, null);

  return layers;
}
