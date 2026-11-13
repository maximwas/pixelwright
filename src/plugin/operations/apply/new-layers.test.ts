import { describe, expect, it } from "vitest";
import { PlacementSpan } from "@/core/kernel/geometry/placement-span.ts";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import { Capabilities } from "@/plugin/adapters/figma/capabilities.ts";
import { ComponentIndex } from "@/plugin/adapters/figma/components/component-index.ts";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";
import { LayerFactory } from "@/plugin/adapters/figma/layer-factory.ts";
import { NewLayers } from "@/plugin/operations/apply/new-layers.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

const CHANGE = { line: 1, column: 1, kind: "create", ref: "new:1", id: null, tag: "Frame", parent: null, index: 0 };

// No Figma here (CLAUDE.md): a stand-in holder and layer that only record where the layer is. The failing step is a
// field Figma would refuse, simulated by a setter that throws; no input of the tool reaches such a refusal (live:
// every wrap, hug and place case writes), so the live suite cannot cover it.
type Holder = { children: SceneNode[]; node: Pick<FrameNode, "children" | "appendChild" | "insertChild"> };
type Layer = { type: "FRAME"; removed: boolean; remove(): void; layoutMode: "HORIZONTAL" };

function holder(): Holder {
  const children: SceneNode[] = [];

  return {
    children,
    node: {
      children,
      appendChild: (child) => {
        children.push(child);
      },
      insertChild: (index, child) => {
        children.splice(index, 0, child);
      },
    },
  };
}

function layer(parent: Holder, refuses: string): Layer {
  const node: Layer = {
    type: "FRAME",
    removed: false,
    layoutMode: "HORIZONTAL",
    remove() {
      node.removed = true;
      parent.children.splice(parent.children.indexOf(node as SceneNode), 1);
    },
  };

  Object.defineProperty(node, refuses, {
    set() {
      throw new Error(`Figma refuses ${refuses}`);
    },
    get: () => undefined,
  });

  return node;
}

function newLayers(node: Layer): NewLayers {
  return new NewLayers(
    Object.assign(new LayerFactory(new ComponentIndex(new Variants())), { make: () => node as SceneNode }),
    new Assign(),
    new Capabilities(),
    new PlacementSpan(),
  );
}

describe("new layers: a layer whose creation fails after it exists is taken away", () => {
  it("leaves nothing in the parent when its bare start throws", () => {
    const parent = holder();
    const node = layer(parent, "clipsContent");

    expect(() =>
      newLayers(node).create("FRAME", CHANGE as ApplyChangeData, { parent: parent.node as FrameNode, index: 0 }),
    ).toThrow();
    expect(parent.children).toEqual([]);
  });

  it("leaves nothing in the parent when finishing it throws", () => {
    const parent = holder();
    const node = layer(parent, "layoutSizingHorizontal");
    const layers = newLayers(node);

    parent.node.appendChild(node as SceneNode);

    expect(() => layers.finish(node as SceneNode, {})).toThrow();
    expect(parent.children).toEqual([]);
  });
});
