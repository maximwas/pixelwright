import { expect, it } from "vitest";
import { LayerWalk } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
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
  const { layers, cuts } = await new ReadRun(new LayerWalk({ now: () => 0 })).read([root], tree, {
    jsonChars: 5 * size,
  });
  const [top] = layers;

  expect(top?.children?.map(({ id }) => id)).toEqual(["a0", "b0", "c0"]);
  expect(top?.children?.[0]?.children?.map(({ id }) => id)).toEqual(["a1"]);
  expect(top?.children?.[2]?.children).toBeUndefined();
  expect(cuts).toEqual([
    { id: "a0", reason: "budget" },
    { id: "c0", reason: "budget" },
  ]);
});

// P-075: a read of a big frame awaits Figma per layer; it stops at the op's deadline as at its budget, with what it read.
it("stops at the read's deadline as at its budget: what it did not finish is a budget cut", async () => {
  const clock = { ms: 0, now: () => clock.ms };
  const plain = new PlainTree();
  // Each layer takes 8 s: the root and two of its children are read before the 20 s pass, the third is not.
  const slow: ReadTree<PlainNode> = {
    entry: (node) => {
      clock.ms += 8_000;

      return plain.entry(node);
    },
    children: (node) => plain.children(node),
  };
  const root = layer("r0", [layer("a0", [layer("a1")]), layer("b0"), layer("c0")]);
  const { layers, cuts } = await new ReadRun(new LayerWalk(clock)).read([root], slow, { jsonChars: 1_000_000 });

  expect(layers[0]?.children?.map(({ id }) => id)).toEqual(["a0", "b0"]);
  expect(cuts).toEqual([
    { id: "r0", reason: "budget" },
    { id: "a0", reason: "budget" },
  ]);
});
