import { describe, expect, it } from "vitest";
import { RecentActions } from "@/plugin-ui/view/recent-actions.ts";
import { ACTION_NAME } from "@/plugin-ui/view/view.constants.ts";
import { OP_CONTRACTS } from "@/shared/ops/op.catalog.ts";

describe("RecentActions (P-051)", () => {
  it("keeps the last five actions newest first, each with its time, a failure as a warning", () => {
    const actions = new RecentActions();

    for (const at of [1, 2, 3, 4, 5]) {
      actions.add({ op: "selection", outcome: "done" }, at);
    }

    actions.add({ op: "execute", outcome: "failed" }, 6);

    expect(actions.lines()).toEqual([
      { text: "Ran code — failed", warning: true, at: 6 },
      { text: "Read the selection", warning: false, at: 5 },
      { text: "Read the selection", warning: false, at: 4 },
      { text: "Read the selection", warning: false, at: 3 },
      { text: "Read the selection", warning: false, at: 2 },
    ]);
    // Code that failed still ran, and may outlive the switch (P-012).
    expect(actions.ranCode()).toBe(true);
  });

  it("names every op the activity lists: none goes by its bare op name", () => {
    const unnamed = OP_CONTRACTS.all()
      .filter((contract) => !(contract.declared.quiet ?? false) && ACTION_NAME[contract.name] === undefined)
      .map(({ name }) => name);

    expect(unnamed).toEqual([]);
  });

  it("words a refused write, and remembers it until Allow edits goes on (P-012)", () => {
    const actions = new RecentActions();

    actions.add({ op: "execute", outcome: "refused" }, 1);

    expect(actions.lines()).toEqual([{ text: "Edit refused: Allow edits is off", warning: true, at: 1 }]);
    expect(actions.refused()).toBe(true);
    // Refused code never ran.
    expect(actions.ranCode()).toBe(false);

    actions.forgetRefusal();

    expect(actions.refused()).toBe(false);
  });
});
