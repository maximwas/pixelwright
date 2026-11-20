import { describe, expect, it } from "vitest";
import { OpReport } from "@/plugin/app/op-report.ts";
import { BindWriteOperation } from "@/plugin/operations/bind/bind-write.operation.ts";
import type { BindPlan, PlannedBind, PlannedRemap } from "@/shared/ops/bind/bind.schema.ts";

const TARGET = { token: "--Brand", id: "VariableID:Brand", source: "variable" as const };

const PLAN: BindPlan = {
  binds: [
    { layer: "1:2", kind: "number", fields: ["itemSpacing"], target: TARGET, snapped: false },
    { layer: "1:3", kind: "effect", target: { token: "--Shadow", id: "S:shadow", source: "style" }, snapped: false },
    { layer: "1:3", kind: "number", fields: ["paddingTop"], target: TARGET, snapped: false },
  ],
  remaps: [{ layer: "1:4", from: "VariableID:Old", to: TARGET }],
};

describe("BindWriteOperation", () => {
  it("binds every planned use and rebind, a refusal its layer's failure while the rest are bound, all one undo step (T-167)", async () => {
    const log: string[] = [];
    const uses = {
      bind: async ({ layer, kind }: PlannedBind) => {
        if (kind === "effect") {
          throw new Error("Figma cannot reach the style --Shadow now: enable its library.");
        }

        log.push(`bind ${layer} ${kind}`);
      },
    };
    const remaps = { remap: async ({ layer }: PlannedRemap) => log.push(`remap ${layer}`) };
    const history = { commitUndo: () => log.push("undo") };
    const operation = new BindWriteOperation(new OpReport(), uses as never, remaps as never, history as never);

    expect(await operation.run(PLAN)).toMatchObject({
      ok: true,
      data: { failed: [{ id: "1:3", message: "Figma cannot reach the style --Shadow now: enable its library." }] },
      touched: ["1:2", "1:3", "1:4"],
    });
    expect(log).toEqual(["bind 1:2 number", "bind 1:3 number", "remap 1:4", "undo"]);
  });
});
