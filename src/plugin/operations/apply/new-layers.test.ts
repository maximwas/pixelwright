import { describe, expect, it } from "vitest";
import { PlacementSpan } from "@/core/kernel/geometry/placement-span.ts";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import { Capabilities } from "@/plugin/adapters/figma/capabilities.ts";
import { ComponentIndex } from "@/plugin/adapters/figma/components/component-index.ts";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";
import { LayerFactory } from "@/plugin/adapters/figma/layer-factory.ts";
import { NewLayers } from "@/plugin/operations/apply/new-layers.ts";
import { Origins } from "@/plugin/operations/apply/origins.ts";
import { PendingSets } from "@/plugin/operations/apply/pending-sets.ts";
import { ApplyReport } from "@/plugin/operations/apply/report.ts";
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

describe("new layers: a layer whose bare start fails after it exists is taken away", () => {
  it("leaves nothing in the parent when its bare start throws", () => {
    const parent = holder();
    const node = layer(parent, "clipsContent");

    expect(() =>
      newLayers(node).create("FRAME", CHANGE as ApplyChangeData, { parent: parent.node as FrameNode, index: 0 }),
    ).toThrow();
    expect(parent.children).toEqual([]);
  });
});

// No Figma here (CLAUDE.md): a layer is plain data that holds children, with the one Figma call a move is, insertChild.
// No input of the tool leads a layer that is no Component into a set's frame (design_apply refuses it first), so the
// live suite cannot cover this last guard.
interface Piece {
  readonly id: string;
  readonly type: string;
  readonly children: Piece[];
  parent: Piece | null;
  removed: boolean;
  insertChild(index: number, node: Piece): void;
  remove(): void;
}

function piece(
  id: string,
  type: string,
  children: Piece[] = [],
  insertChild?: Piece["insertChild"],
): Piece {
  const stub: Piece = {
    id,
    type,
    children,
    parent: null,
    removed: false,
    insertChild:
      insertChild ??
      ((index, node) => {
        node.parent?.children.splice(node.parent.children.indexOf(node), 1);
        stub.children.splice(index, 0, node);
        node.parent = stub;
      }),
    remove() {
      stub.removed = true;
      stub.parent?.children.splice(stub.parent.children.indexOf(stub), 1);
    },
  };

  for (const child of children) {
    child.parent = stub;
  }

  return stub;
}

/** A set's frame holding a Component and a layer of the user's that the call moved there from `origin`. */
function holding(origin: Piece) {
  const kept = origin.children[1] as Piece;
  const variant = piece("v", "COMPONENT");
  const frame = piece("holder", "FRAME");
  const set = piece("set", "COMPONENT_SET");
  const page = piece("page", "PAGE", [frame]);
  const origins = new Origins();

  origins.record(kept as never);
  frame.insertChild(0, kept);
  frame.insertChild(0, variant);

  const factory = Object.assign(new LayerFactory(new ComponentIndex(new Variants())), {
    combine: (
      components: Piece[],
      parent: Piece,
      index: number,
    ) => {
      parent.insertChild(index, set);

      for (const component of components) {
        set.insertChild(set.children.length, component);
      }

      return set;
    },
  });
  const layers = new NewLayers(factory as never, new Assign(), new Capabilities(), new PlacementSpan());

  return { kept, frame, page, set, origins, layers };
}

describe("NewLayers.combine: the frame holding a new set's variants goes only when no layer of the user's is in it", () => {
  it("puts a layer the call did not make back where it stood before the frame goes", () => {
    const origin = piece("origin", "FRAME", [piece("a", "FRAME"), piece("keep", "FRAME")]);
    const { kept, frame, page, set, origins, layers } = holding(origin);

    layers.combine(frame as never, origins);

    expect(origin.children).toEqual([origin.children[0], kept]);
    expect(frame.removed).toBe(true);
    expect(page.children).toEqual([set]);
  });

  it("keeps the frame, and says so, when such a layer cannot go back", () => {
    const origin = piece("origin", "FRAME", [piece("a", "FRAME"), piece("keep", "FRAME")], () => {
      throw new Error("The node has been removed");
    });
    const { kept, frame, origins, layers } = holding(origin);

    expect(() => layers.combine(frame as never, origins)).toThrow("stays in the file");
    expect(frame.removed).toBe(false);
    expect(kept.parent).toBe(frame);
  });
});

// A new set that cannot be finished (its auto layout hug refused) goes with the variants it holds, but a Component of
// the user's that the call moved into it goes back where it stood first, and when it cannot nothing goes. Finishing
// the set is what refuses here, the step after combine: the set holds the Components by then.
describe("PendingSets.settle: a new set whose finish throws", () => {
  const SET = { line: 1, column: 1, kind: "create", ref: "s", id: null, tag: "ComponentSet", parent: null, index: 0 };

  async function settled(origin: Piece) {
    const held = holding(origin);

    Object.defineProperty(held.set, "layoutSizingHorizontal", {
      set() {
        throw new Error("Figma refuses layoutSizingHorizontal");
      },
      get: () => undefined,
    });

    const { layers, origins, frame } = held;
    const report = new ApplyReport();
    const change = SET as ApplyChangeData;
    const sets = new PendingSets(
      { write: async () => true } as never,
      {
        combine: (node: SceneNode, kept: Origins) => layers.combine(node, kept),
        finish: (node: SceneNode, one: ApplyChangeData) => layers.finish(node, one.props ?? {}),
        discard: (node: SceneNode) => layers.discard(node),
      } as never,
      { start: () => undefined, add: () => undefined } as never,
      { start: () => undefined, bind: async () => ({ bound: [], failed: [] }) } as never,
    );
    const run = {
      changes: [change],
      layers: new Map(),
      sets: [{ change, holder: frame, refusals: [], placing: [] }],
      report,
      origins,
    } as never;

    await sets.settle(run);

    return { ...held, report };
  }

  it("puts a Component the call moved into it back before the set goes", async () => {
    const origin = piece("origin", "FRAME", [piece("a", "FRAME"), piece("keep", "COMPONENT")]);
    const { kept, set, report } = await settled(origin);

    expect(set.removed).toBe(true);
    expect(origin.children).toContain(kept);
    expect(kept.parent).toBe(origin);
    expect(report.result().errors).toMatchObject([{ message: "Figma refuses layoutSizingHorizontal" }]);
  });

  it("keeps the set, and says so, when such a Component cannot go back", async () => {
    const origin = piece("origin", "FRAME", [piece("a", "FRAME"), piece("keep", "COMPONENT")], () => {
      throw new Error("The node has been removed");
    });
    const { kept, set, report } = await settled(origin);

    expect(set.removed).toBe(false);
    expect(kept.parent).toBe(set);
    expect(report.result().errors).toMatchObject([
      { message: expect.stringContaining("stays in the file") },
      { message: "Figma refuses layoutSizingHorizontal" },
    ]);
  });
});
