import { expect, it } from "vitest";
import { ReadRun, type ReadTree } from "@/plugin/operations/read/read-run.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A layer of the plain tree: an id of two characters, so every entry is as long as the next, and its children. */
interface PlainNode {
  readonly id: string;
  readonly children: readonly PlainNode[];
}

const layer = (id: string, children: readonly PlainNode[] = []): PlainNode => ({ id, children });

/** The tree ReadRun walks here in place of Figma's: an entry per layer, its child count honest. */
class PlainTree implements ReadTree<PlainNode> {
  entry(node: PlainNode): ReadLayer {
    return {
      id: node.id,
      name: node.id,
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      childCount: node.children.length,
    };
  }

  children(node: PlainNode): readonly PlainNode[] {
    return node.children;
  }
}

// K-034, m:ec973ea3: the budget can stop a read mid-children, and that layer is a cut as much as one left unread.
it("reads breadth first under the budget and reports a layer cut mid-children as a cut, and one left unread", async () => {
  const tree = new PlainTree();
  const root = layer("r0", [layer("a0", [layer("a1"), layer("a2")]), layer("b0"), layer("c0", [layer("c1")])]);
  const size = JSON.stringify(tree.entry(root)).length;

  // The root, its three children and a0's first child fit; a0's second does not, and c0 is never opened.
  const { layers, cuts } = await new ReadRun().read([root], tree, { jsonChars: 5 * size });
  const [top] = layers;

  expect(top?.children?.map(({ id }) => id)).toEqual(["a0", "b0", "c0"]);
  expect(top?.children?.[0]?.children?.map(({ id }) => id)).toEqual(["a1"]);
  expect(top?.children?.[2]?.children).toBeUndefined();
  expect(cuts).toEqual([
    { id: "a0", reason: "budget" },
    { id: "c0", reason: "budget" },
  ]);
});
