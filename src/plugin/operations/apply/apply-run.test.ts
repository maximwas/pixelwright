import { describe, expect, it, vi } from "vitest";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { ApplyRun } from "@/plugin/operations/apply/apply-run.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

// No Figma here (CLAUDE.md): the run's collaborators are plain objects; the live suite moves real layers.
const node = { id: "1:5", type: "FRAME", name: "Card", parent: { id: "0:1", type: "PAGE" } };

function moving(neighbour: { before?: string; after?: string }): ApplyChangeData {
  return {
    line: 3,
    column: 5,
    kind: "update",
    ref: "1:5",
    id: "1:5",
    tag: "Frame",
    parent: "1:1",
    index: 0,
    ...neighbour,
    moves: true,
    props: { opacity: 0.5 },
    sources: { opacity: "opacity" },
  } as ApplyChangeData;
}

function build() {
  const written: ApplyChangeData[] = [];
  const layers = {
    top: async () => node.parent,
    of: async () => node,
    move: async () => {
      throw new WriteError("2:2 is not in this element's parent: before and after name a layer beside it.");
    },
    refusals: () => [],
  };
  const writer = { prepare: async () => undefined, checks: async () => [] };
  const sets = {
    start: () => undefined,
    write: vi.fn(async (_run: unknown, change: ApplyChangeData) => {
      written.push(change);
    }),
    settle: async () => undefined,
    properties: () => [],
  };
  const run = new ApplyRun(layers as never, writer as never, sets as never, { commitUndo: () => undefined } as never);

  return { run, written };
}

describe("ApplyRun: a move refused (T-124, P-143)", () => {
  it("keeps the layer where it is, writes its other attributes and puts the error on before", async () => {
    const { run, written } = build();
    const result = await run.run({ changes: [moving({ before: "2:2" })], dryRun: false });

    expect(result.errors).toEqual([
      expect.objectContaining({ line: 3, id: "1:5", attribute: "before", message: expect.stringContaining("2:2") }),
    ]);
    expect(written.map(({ props, moves }) => [props, moves])).toEqual([[{ opacity: 0.5 }, false]]);
  });

  it("names after when after placed it, and no attribute when its parent did", async () => {
    const after = await build().run.run({ changes: [moving({ after: "2:2" })], dryRun: false });
    const parent = await build().run.run({ changes: [moving({})], dryRun: false });

    expect(after.errors[0]?.attribute).toBe("after");
    expect(parent.errors[0]?.attribute).toBeUndefined();
  });

  it("lists a dry run's layer as changed by its other attributes only", async () => {
    const { run } = build();
    const result = await run.run({ changes: [moving({ before: "2:2" })], dryRun: true });

    expect(result.errors).toHaveLength(1);
    expect(result.changed).toEqual(["1:5"]);
  });
});

// m:f66aed65: a real run holds a new set's variants in a plain frame until they combine; its checks are the set's, as a
// dry run's are, so a component set's own attributes (a description) pass on both runs.
describe("ApplyRun: a new ComponentSet on a real run", () => {
  it("is checked as a set, not as the frame that holds its variants", async () => {
    const holder = { id: "3:1", type: "FRAME", name: "Set", parent: node.parent };
    const checked: string[] = [];
    const layers = {
      top: async () => node.parent,
      of: async () => holder,
      move: async () => undefined,
      refusals: () => [],
    };
    const writer = {
      prepare: async () => undefined,
      checks: async (_change: unknown, layer: { type: string }) => {
        checked.push(layer.type);

        return [];
      },
    };
    const sets = { start: () => undefined, hold: () => undefined, settle: async () => undefined, properties: () => [] };
    const run = new ApplyRun(layers as never, writer as never, sets as never, { commitUndo: () => undefined } as never);
    const set = { ...moving({}), kind: "create", id: null, ref: "new:1", tag: "ComponentSet", moves: false };

    await run.run({ changes: [set as ApplyChangeData], dryRun: false });

    expect(checked).toEqual(["COMPONENT_SET"]);
  });
});
