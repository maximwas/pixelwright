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
