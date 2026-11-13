import { describe, expect, it } from "vitest";
import type { PlannedTokens } from "@/core/tokens/plan/plan.types.ts";
import { TOKENS_APPLY_TEXT } from "@/server/tools/tokens-apply/tokens-apply.constants.ts";
import { TokensApplyTool } from "@/server/tools/tokens-apply/tokens-apply.tool.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import type { AnyOpContract } from "@/shared/ops/op-contract.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

const PLANNED: PlannedTokens = {
  plan: { collections: [], styles: { paint: [], text: [], effect: [] } },
  created: [{ kind: "variable", name: "Gap", collection: "Spacing" }],
  updated: [],
  errors: [],
  notes: [],
};

/** The tool over a session that keeps every op it is asked to run, and a planner that answers PLANNED. */
function setup() {
  const ops: AnyOpContract[] = [];
  const session = {
    run: async (op: AnyOpContract) => {
      ops.push(op);

      return {};
    },
  };
  const tool = new TokensApplyTool(
    session as never,
    {} as never,
    { due: () => null } as never,
    { plan: () => PLANNED } as never,
  );

  return { tool, ops };
}

describe("TokensApplyTool", () => {
  it("refuses a real run before it reads anything, and says how to dry-run", async () => {
    const { tool, ops } = setup();

    await expect(tool.execute({ tokens: {}, dryRun: false })).rejects.toMatchObject({
      code: ERROR_CODE.opFailed,
      message: TOKENS_APPLY_TEXT.dryOnly,
    });
    expect(ops).toEqual([]);
  });

  it("answers a dry run from the plan after one read, and calls no op that writes", async () => {
    const { tool, ops } = setup();
    const answer = await tool.execute({ tokens: {}, dryRun: true });

    expect(ops).toEqual([variablesOp]);
    expect(ops.some((op) => op.declared.write)).toBe(false);
    expect(answer.structuredContent).toEqual({ created: PLANNED.created, updated: [], errors: [], dry: true });
  });
});
