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
  name: "execute",
  input: zod.object({}),
  output: zod.unknown(),
  meta: { write: true, dryRun: false, timeoutMs: 30_000, needsAllowEdits: true, turn: "write" },
});
const writeLike = new OpContract({
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

  // An agent refused execute read "dryRun checks changes without it": execute has no dry run, and reads need no code.
  it("names dryRun only for an op that has one, and tells execute's caller how to read with Allow edits off", async () => {
    const message = async (call: Parameters<EditsStep["handle"]>[0]) => {
      const result = await step.handle(call, next);

      return result.ok ? "" : result.error.message;
    };

    expect(await message({ contract: applyLike, input: { dryRun: false } })).toContain("dryRun");

    // The text is chosen by the op's dry run meta, not its name: any op without one gets the same text.
    for (const contract of [writeLike, executeLike]) {
      const refused = await message({ contract, input: {} });

      expect(refused).not.toContain("dryRun");
      expect(refused).toMatch(/script/);
      expect(refused).toMatch(/inspect, nodes_find, design_read/);
    }
  });
});
