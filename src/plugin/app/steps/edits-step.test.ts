import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { EditsSwitch } from "@/core/ports/edits-switch.port.ts";
import { EditsStep } from "@/plugin/app/steps/edits-step.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";

class SwitchOff implements EditsSwitch {
  async isOn(): Promise<boolean> {
    return false;
  }

  async set(): Promise<void> {}
}

// Stand-ins with apply's and execute's meta (A§5.5): the step reads only the contract, nothing kept by hand.
const applyLike = new OpContract({
  name: "ping",
  input: zod.object({ dryRun: zod.boolean() }),
  output: zod.unknown(),
  meta: { write: true, dryRun: true, timeoutMs: 30_000, needsAllowEdits: (input) => !input.dryRun, turn: "write" },
});
const executeLike = new OpContract({
  name: "ping",
  input: zod.object({}),
  output: zod.unknown(),
  meta: { write: true, dryRun: false, timeoutMs: 30_000, needsAllowEdits: true, turn: "write" },
});
const ran: OpResult = { ok: true, data: null, cuts: [], missing: [], touched: [] };

describe("EditsStep (P-010, D-07)", () => {
  const step = new EditsStep(new SwitchOff());
  const next = async () => ran;

  it("lets apply's dry run through with Allow edits off", async () => {
    expect(await step.handle({ contract: applyLike, input: { dryRun: true } }, next)).toBe(ran);
  });

  it("refuses apply for real and execute while Allow edits is off", async () => {
    for (const call of [
      { contract: applyLike, input: { dryRun: false } },
      { contract: executeLike, input: {} },
    ]) {
      expect(await step.handle(call, next)).toMatchObject({ ok: false, error: { code: "EDITS_DISABLED" } });
    }
  });
});
