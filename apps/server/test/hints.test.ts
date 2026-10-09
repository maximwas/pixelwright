import { describe, expect, it } from "vitest";
import { bridgeHint } from "../src/bridge/hints.ts";

describe("bridgeHint", () => {
  it("has the model relay the pairing code and never type it, without calling the waiting socket a file", () => {
    const hint = bridgeHint({
      state: { kind: "owner" },
      connectedFiles: 0,
      pairing: {
        code: "123456",
        expiresAt: 90_000,
        lockedUntil: null,
        waiting: 1,
      },
      rejection: null,
      port: 18_720,
      now: 0,
    });

    expect(hint).toContain("123456");
    expect(hint).toContain("Pixelwright window");
    expect(hint).toContain("never type or send it");
    expect(hint).toMatch(/^A plugin is waiting to be paired/);
  });
});
