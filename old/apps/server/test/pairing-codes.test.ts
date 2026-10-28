import { describe, expect, it } from "vitest";
import { PairingCodes } from "../src/bridge/pairing-codes.ts";

function codes() {
  let now = 0;
  let next = 0;
  const pairing = new PairingCodes({
    now: () => now,
    randomDigits: () => String(123_456 + next++).padStart(6, "0"),
    ttlMs: 1_000,
    attempts: 2,
    cooldownMs: 100,
    maxCooldownMs: 250,
  });

  return {
    pairing,
    advance: (ms: number) => {
      now += ms;
    },
    /** Makes a code and spends both of its tries. */
    exhaust: () => {
      pairing.ensure();
      pairing.check("000000");
      pairing.check("000001");
    },
  };
}

describe("PairingCodes", () => {
  it("keeps one code until it expires", () => {
    const { pairing, advance } = codes();

    expect(pairing.active()).toBeNull();
    expect(pairing.ensure()?.code).toBe("123456");
    expect(pairing.ensure()?.code).toBe("123456");
    advance(1_000);
    expect(pairing.active()).toBeNull();
    expect(pairing.ensure()?.code).toBe("123457");
  });

  it("accepts the code once", () => {
    const { pairing } = codes();
    const code = pairing.ensure()?.code ?? "";

    expect(pairing.check(code)).toEqual({ outcome: "ok" });
    expect(pairing.check(code)).toEqual({ outcome: "expired" });
  });

  it("locks pairing after a code's tries run out, longer each time, up to a limit", () => {
    const { pairing, advance, exhaust } = codes();

    exhaust();
    expect(pairing.ensure()).toBeNull();
    expect(pairing.lockedUntil()).toBe(100);
    expect(pairing.check("123456")).toEqual({
      outcome: "locked",
      until: 100,
    });
    advance(100);
    exhaust();
    expect(pairing.lockedUntil()).toBe(300);
    advance(200);
    exhaust();
    expect(pairing.lockedUntil()).toBe(550);
  });

  it("starts the pauses over after a successful pairing", () => {
    const { pairing, advance, exhaust } = codes();

    exhaust();
    advance(100);
    exhaust();
    advance(200);

    const code = pairing.ensure()?.code ?? "";

    expect(pairing.check(code)).toEqual({ outcome: "ok" });
    exhaust();
    expect(pairing.lockedUntil()).toBe(400);
  });
});
