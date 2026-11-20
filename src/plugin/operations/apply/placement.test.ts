import { describe, expect, it } from "vitest";
import { Capabilities } from "@/plugin/adapters/figma/capabilities.ts";
import type { ApplyCall } from "@/plugin/operations/apply/apply.types.ts";
import { Placement } from "@/plugin/operations/apply/placement.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

// No Figma here (CLAUDE.md): a layer is plain data that holds children, with the one Figma call a move is, insertChild.
interface Stub {
  readonly id: string;
  readonly type: string;
  readonly children: Stub[];
  parent: Stub | null;
  insertChild(index: number, node: Stub): void;
}

function layer(id: string, children: Stub[] = []): Stub {
  const stub: Stub = {
    id,
    type: "FRAME",
    children,
    parent: null,
    insertChild(index, node) {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      stub.children.splice(index, 0, node);
      node.parent = stub;
    },
  };

  for (const child of children) {
    child.parent = stub;
  }

  return stub;
}

describe("Placement.move", () => {
  it("records where the layer stood before the move writes it", async () => {
    const node = layer("e");
    const before = layer("p", [layer("a"), node]);
    const top = layer("t");
    const recorded: string[] = [];
    const change = { kind: "update", ref: "e", id: "e", parent: null, moves: true } as ApplyChangeData;
    const call = {
      dry: false,
      changes: [change],
      top,
      layers: new Map(),
      failed: new Map(),
      counterparts: {},
      origins: {
        record: (one: Stub) => recorded.push(`${one.id} in ${one.parent?.id} at ${one.parent?.children.indexOf(one)}`),
      },
    } as never as ApplyCall;

    await new Placement({} as never, {} as never, new Capabilities()).move(node as never, change, call);

    expect(recorded).toEqual(["e in p at 1"]);
    expect(top.children).toEqual([node]);
    expect(before.children.map(({ id }) => id)).toEqual(["a"]);
  });

  it("records nothing on a dry run, which moves nothing", async () => {
    const node = layer("e");
    const recorded: string[] = [];
    const change = { kind: "update", ref: "e", id: "e", parent: null, moves: true } as ApplyChangeData;
    const call = {
      dry: true,
      changes: [change],
      top: layer("t"),
      layers: new Map(),
      failed: new Map(),
      counterparts: {},
      origins: { record: (one: Stub) => recorded.push(one.id) },
    } as never as ApplyCall;

    layer("p", [node]);
    await new Placement({} as never, {} as never, new Capabilities()).move(node as never, change, call);

    expect(recorded).toEqual([]);
  });
});
