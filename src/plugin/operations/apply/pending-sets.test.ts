import { describe, expect, it } from "vitest";
import { PendingSets } from "@/plugin/operations/apply/pending-sets.ts";
import { ApplyReport } from "@/plugin/operations/apply/report.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

// No Figma here (CLAUDE.md): a layer is plain data; binding a mark is the one step simulated, the way Figma refuses it
// (a name taken by another kind) when two layers of one call ask for the same name.
function change(ref: string, kind: "create" | "update"): ApplyChangeData {
  return {
    line: 1,
    column: 1,
    kind,
    ref,
    id: kind === "update" ? "9:9" : null,
    tag: "Text",
    parent: null,
    index: 0,
    props: {},
    sources: {},
  } as ApplyChangeData;
}

function settled(
  refused: { id: string; inner: string[] },
  kind: "create" | "update",
  restore: (node: { id: string }) => void = () => undefined,
) {
  const discarded: string[] = [];
  const node = { id: refused.id, findAll: () => refused.inner.map((id) => ({ id })) };
  const marks = {
    start: () => undefined,
    bind: async () => ({ bound: [], failed: [{ node, error: new Error("taken") }] }),
  };
  const sets = new PendingSets(
    {} as never,
    { discard: (one: { id: string }) => discarded.push(`discard ${one.id}`) } as never,
    {} as never,
    marks as never,
  );
  const report = new ApplyReport();
  const made = change("t", kind);
  const origins = { restore };
  const run = { changes: [made], layers: new Map([["t", node]]), sets: [], report, origins } as never;

  if (kind === "create") {
    report.made(made, { id: refused.id, name: "Text" });

    for (const id of refused.inner) {
      report.made(change(id, "create"), { id, name: "Inner" });
    }
  }

  return { sets, run, report, discarded };
}

describe("PendingSets.settle: a mark that cannot bind", () => {
  it("takes away a layer the call made, and what it holds, and says no more that they were made", async () => {
    const { sets, run, report, discarded } = settled({ id: "1:1", inner: ["1:2"] }, "create");

    await sets.settle(run);

    expect(discarded).toEqual(["discard 1:1"]);
    expect(report.result().created).toEqual([]);
    expect(report.result().errors).toMatchObject([{ message: "taken" }]);
  });

  it("keeps a layer that was there before the call and tells the error", async () => {
    const { sets, run, report, discarded } = settled({ id: "9:9", inner: [] }, "update");

    await sets.settle(run);

    expect(discarded).toEqual([]);
    expect(report.result().errors).toMatchObject([{ message: "taken" }]);
  });
});

// A layer the call did not make is never the call's to destroy: what was moved into the layer that goes is put back
// first, and when it cannot be, nothing goes.
describe("PendingSets.settle: a layer the call moved into the one that cannot bind", () => {
  it("is put back before the layer goes", async () => {
    const order: string[] = [];
    const { sets, run, discarded } = settled({ id: "1:1", inner: [] }, "create", (node) =>
      order.push(`restore ${node.id}`),
    );

    await sets.settle(run);
    order.push(...discarded);

    expect(order).toEqual(["restore 1:1", "discard 1:1"]);
  });

  it("keeps the layer and says so when it cannot be put back", async () => {
    const { sets, run, report, discarded } = settled({ id: "1:1", inner: ["1:2"] }, "create", () => {
      throw new Error("The node has been removed");
    });

    await sets.settle(run);

    expect(discarded).toEqual([]);
    expect(report.result().created).toHaveLength(2);
    expect(report.result().errors).toMatchObject([
      { message: "taken" },
      { message: expect.stringContaining("stays in the file") },
    ]);
    expect(report.result().errors[1]?.message).toContain("The node has been removed");
  });

  it("is asked of nothing for a layer that was there before the call", async () => {
    const asked: string[] = [];
    const { sets, run } = settled({ id: "9:9", inner: [] }, "update", (node) => asked.push(node.id));

    await sets.settle(run);

    expect(asked).toEqual([]);
  });
});

describe("PendingSets.write: a new layer whose finish throws", () => {
  it("is taken away, its error going on", async () => {
    const discarded: string[] = [];
    const node = { id: "1:1", findAll: () => [] };
    const sets = new PendingSets(
      { write: async () => true } as never,
      {
        finish: () => {
          throw new Error("Figma refuses it");
        },
        discard: (one: { id: string }) => discarded.push(one.id),
      } as never,
      {} as never,
      {} as never,
    );
    const made = change("t", "create");
    const run = { changes: [made], layers: new Map(), sets: [], report: new ApplyReport(), origins: { restore() {} } };

    await expect(sets.write(run as never, made, node as never, [])).rejects.toThrow("Figma refuses it");
    expect(discarded).toEqual(["1:1"]);
    expect(run.report.result().created).toEqual([]);
  });
});
