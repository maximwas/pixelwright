import { overlaps, type SnapshotNode } from "@pixelwright/core";
import { isLayer } from "../../figma/nodes.ts";
import { readSubtree, type SnapshotBudget } from "./subtree.ts";

/**
 * The layers above a read's root up to its page, nearest first: what lies behind it and over it on the canvas. Each
 * has those of its shown children whose box overlaps the root's, read whole under the call's budget; the child the
 * root is in comes as a bare entry, so core knows where it goes.
 */
export async function ancestorsOf(
  root: SceneNode,
  budget: SnapshotBudget,
  read: (node: SceneNode) => Promise<SnapshotNode>,
): Promise<SnapshotNode[]> {
  const box = root.absoluteBoundingBox;
  const ancestors: SnapshotNode[] = [];
  let inner: SceneNode = root;

  while (box !== null && inner.parent !== null && isLayer(inner.parent)) {
    const parent: SceneNode & ChildrenMixin = inner.parent;
    const entry = await read(parent);
    const children: SnapshotNode[] = [];

    for (const child of parent.children) {
      const meets = child.visible && child.absoluteBoundingBox !== null && overlaps(child.absoluteBoundingBox, box);

      if (child === inner) {
        children.push(await read(child));
      } else if (meets) {
        children.push(await readSubtree(child, budget, { read }));
      }
    }

    entry.children = children;
    ancestors.push(entry);
    inner = parent;
  }

  return ancestors;
}
