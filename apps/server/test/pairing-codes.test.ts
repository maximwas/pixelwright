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
  });

  return {
    pairing,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("PairingCodes", () => {
  it("keeps one code until it expires", () => {
    const { pairing, advance } = codes();

    expect(pairing.active()).toBeNull();
    expect(pairing.ensure().code).toBe("123456");
    expect(pairing.ensure().code).toBe("123456");
    advance(1_000);
    expect(pairing.active()).toBeNull();
    expect(pairing.ensure().code).toBe("123457");
  });

  it("accepts the code once", () => {
    const { pairing } = codes();
    const { code } = pairing.ensure();

    expect(pairing.check(code)).toEqual({ outcome: "ok" });
    expect(pairing.check(code)).toEqual({ outcome: "expired" });
  });

  it("rotates the code after the last wrong try, and refuses the old one", () => {
    const { pairing } = codes();
    const { code } = pairing.ensure();

    expect(pairing.check("000000")).toEqual({
      outcome: "wrong",
      attemptsLeft: 1,
    });
    expect(pairing.check("000001")).toEqual({
      outcome: "wrong",
      attemptsLeft: 0,
    });
    expect(pairing.check(code)).toEqual({ outcome: "expired" });
    expect(pairing.ensure().code).not.toBe(code);
  });
});
