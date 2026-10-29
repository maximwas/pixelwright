import { describe, expect, it } from "vitest";
import type { WindowEvents } from "@/core/ports/window-events.port.ts";
import { ActivityStep } from "@/plugin/app/steps/activity-step.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";
import type { ActivityEntry } from "@/shared/window/ui-message.schema.ts";

class Window implements WindowEvents {
  readonly entries: ActivityEntry[] = [];

  activity(entry: ActivityEntry): void {
    this.entries.push(entry);
  }

  busy(): void {}
}

const answered = (data: unknown): OpResult => ({ ok: true, data, cuts: [], missing: [], touched: [] });
const failed = (code: string): OpResult => ({ ok: false, error: { code, message: code } });

describe("ActivityStep (P-051)", () => {
  // O-027: 0.7.0's status probes filled the list with ping.
  it("leaves a quiet op out of the window's activity", async () => {
    const window = new Window();

    await new ActivityStep(window).handle({ contract: pingOp, input: {} }, async () => answered({ pong: true }));

    expect(window.entries).toEqual([]);
  });

  it.each([
    ["done", answered({ result: 1, logs: [] })],
    ["failed", failed("TIMEOUT")],
    // Code that threw still answers: its error is in the data.
    ["failed", answered({ result: null, logs: [], error: "Error: boom" })],
    ["refused", failed("EDITS_DISABLED")],
  ])("lists execute as %s and hands its answer back as it is", async (outcome, result) => {
    const window = new Window();
    const call = { contract: executeOp, input: { code: "return 1", timeoutMs: 1_000 } };

    expect(await new ActivityStep(window).handle(call, async () => result)).toBe(result);
    expect(window.entries).toEqual([{ op: "execute", outcome }]);
  });
});
