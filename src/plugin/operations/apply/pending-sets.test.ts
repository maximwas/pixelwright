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

function settled(refused: { id: string; inner: string[] }, kind: "create" | "update") {
  const discarded: string[] = [];
  const node = { id: refused.id, findAll: () => refused.inner.map((id) => ({ id })) };
  const marks = {
    start: () => undefined,
    bind: async () => ({ bound: [], failed: [{ node, error: new Error("taken") }] }),
  };
  const sets = new PendingSets(
    {} as never,
    { discard: (one: { id: string }) => discarded.push(one.id) } as never,
    {} as never,
    marks as never,
  );
  const report = new ApplyReport();
  const made = change("t", kind);
  const run = { changes: [made], layers: new Map([["t", node]]), sets: [], report } as never;

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

    expect(discarded).toEqual(["1:1"]);
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
