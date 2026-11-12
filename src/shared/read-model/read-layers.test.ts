import { expect, it } from "vitest";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";

function layer(
  id: string,
  children: ReadLayer[] = [],
  visible = true,
): ReadLayer {
  return {
    id,
    name: id,
    type: "FRAME",
    visible,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    childCount: children.length,
    children,
  };
}

// The walk every reader of the model shares: document order, each layer's parent, a refused layer left out whole.
it("walks a read depth first in document order with each layer's parent, leaving out a refused layer's branch", () => {
  const root = layer("r", [layer("a", [layer("a1")]), layer("h", [layer("h1")], false), layer("b")]);
  const layers = new ReadLayers();
  const walked = [...layers.walk(root)].map(({ layer: each, parent }) => `${parent?.id ?? "-"}>${each.id}`);

  expect(walked).toEqual(["->r", "r>a", "a>a1", "r>h", "h>h1", "r>b"]);
  expect([...layers.walk(root, (each) => each.visible)].map(({ layer: each }) => each.id)).toEqual([
    "r",
    "a",
    "a1",
    "b",
  ]);
  expect(layers.visibleChildren(root).map(({ id }) => id)).toEqual(["a", "b"]);
});
