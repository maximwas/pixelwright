import { describe, expect, it } from "vitest";
import { LiveChecks } from "../support/live-checks.ts";
import { LiveLock } from "../support/live-lock.ts";

describe("the live setup's refusals (A§10.5)", () => {
  it("refuses a second run while this one holds the lock", () => {
    expect(() => new LiveLock().acquire()).toThrow(/Another live run \(pid \d+\) holds/);
  });

  it("refuses Test MCP when it is not the visible tab", () => {
    expect(
      new LiveChecks().problem({
        session: "s",
        name: "Test MCP",
        page: "Start here",
        visible: false,
        allowEdits: true,
      }),
    ).toMatch(/^Test MCP is not the visible tab/);
  });
});
