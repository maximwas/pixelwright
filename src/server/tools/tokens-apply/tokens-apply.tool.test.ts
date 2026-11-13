import { describe, expect, it } from "vitest";
import type { PlannedTokens } from "@/core/tokens/plan/plan.types.ts";
import { VersionedWrite } from "@/server/app/writes/versioned-write.ts";
import { TokensApplyTool } from "@/server/tools/tokens-apply/tokens-apply.tool.ts";
import type { AnyOpContract } from "@/shared/ops/op-contract.ts";
import { tokensApplyOp } from "@/shared/ops/tokens-apply/tokens-apply.manifest.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

const NO_STYLES = { paint: [], text: [], effect: [] };

const REFUSED = { kind: "variable" as const, name: "Odd", collection: "Spacing", message: "12em is not a length." };

const PLANNED: PlannedTokens = {
  plan: {
    collections: [
      {
        name: "Spacing",
        modes: [],
        variables: [{ name: "Gap", type: "FLOAT", values: { Base: { kind: "number", value: 4 } } }],
      },
    ],
    styles: NO_STYLES,
  },
  created: [{ kind: "variable", name: "Gap", collection: "Spacing" }],
  updated: [],
  errors: [REFUSED],
  notes: ["planned note"],
};

const WRITTEN = {
  created: [{ kind: "variable", name: "Gap", collection: "Spacing" }],
  updated: [],
  errors: [{ kind: "mode", name: "Dark", collection: "Spacing", message: "The file's Figma plan allows 1 mode." }],
  notes: ["written note"],
};

/** The tool over a session that keeps every op it runs and its input, and a planner that answers `planned`. */
function setup(planned: PlannedTokens) {
  const ops: [AnyOpContract, unknown][] = [];
  const session = {
    run: async (op: AnyOpContract, input: unknown) => {
      ops.push([op, input]);

      return op === tokensApplyOp ? WRITTEN : {};
    },
  };
  const tool = new TokensApplyTool(
    session as never,
    new VersionedWrite(),
    { due: () => null } as never,
    { plan: () => planned } as never,
  );

  return { tool, ops };
}

describe("TokensApplyTool", () => {
  it("answers at once when the plan writes nothing: one read, no op that writes, the plan's errors and notes", async () => {
    const { tool, ops } = setup({ ...PLANNED, plan: { collections: [], styles: NO_STYLES }, created: [] });
    const answer = await tool.execute({ tokens: {}, dryRun: false });

    expect(ops.map(([op]) => op)).toEqual([variablesOp]);
    expect(answer.structuredContent).toEqual({ created: [], updated: [], errors: [REFUSED], notes: ["planned note"] });
  });

  it("writes the plan through the plugin's tokens op: what it wrote, the plan's errors before its own (T-165)", async () => {
    const { tool, ops } = setup(PLANNED);
    const answer = await tool.execute({ tokens: {}, dryRun: false });

    expect(ops).toEqual([
      [variablesOp, { libraries: true, used: true }],
      [tokensApplyOp, { plan: PLANNED.plan, dryRun: false }],
    ]);
    expect(answer.structuredContent).toEqual({
      created: WRITTEN.created,
      updated: [],
      errors: [REFUSED, ...WRITTEN.errors],
      notes: ["planned note", "written note"],
    });
  });

  it("sends a dry run to the plugin too, so it refuses the modes the file's plan has refused (B-055)", async () => {
    const { tool, ops } = setup(PLANNED);
    const answer = await tool.execute({ tokens: {}, dryRun: true });

    expect(ops.at(-1)).toEqual([tokensApplyOp, { plan: PLANNED.plan, dryRun: true }]);
    expect(answer.structuredContent).toMatchObject({ errors: [REFUSED, ...WRITTEN.errors], dry: true });
  });
});
