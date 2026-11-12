import { describe, expect, it } from "vitest";
import { FrameSizeStep } from "@/plugin/app/steps/frame-size-step.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";

const answer = (data: unknown): OpResult => ({ ok: true, data, cuts: [], missing: [], touched: [] });

describe("FrameSizeStep (S-006)", () => {
  const step = new FrameSizeStep();
  const call = { contract: pingOp, input: {} };

  it("turns a 4 MiB + 1 answer into RESULT_TOO_LARGE before it is posted", async () => {
    const result = await step.handle(call, async () => answer("x".repeat(LIMITS.frameBytes + 1)));

    expect(result).toMatchObject({ ok: false, error: { code: "RESULT_TOO_LARGE" } });
  });

  it("counts UTF-8 bytes, not units: two-byte letters under the limit in units are over it in bytes", async () => {
    const result = await step.handle(call, async () => answer("é".repeat(LIMITS.frameBytes / 2 + 1)));

    expect(result).toMatchObject({ ok: false, error: { code: "RESULT_TOO_LARGE" } });
  });
});
