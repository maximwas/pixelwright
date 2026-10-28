import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newKeyId, newNonce, newSecret, proofEquals, proofFor } from "../src/index.ts";

describe("proofs", () => {
  it("is HMAC-SHA256 of the secret over the role and both nonces", () => {
    // Node's own HMAC as the independent reference (node:crypto is fine in tests, never in core's src).
    expect(proofFor("Jefe", "server", "a", "b")).toBe(
      createHmac("sha256", "Jefe").update("pixelwright|server|a|b").digest("hex"),
    );
  });

  it("differs by role and by nonce order, so a proof cannot be reflected", () => {
    const secret = newSecret();
    const [a, b] = [newNonce(), newNonce()];

    expect(proofFor(secret, "server", a, b)).not.toBe(proofFor(secret, "plugin", a, b));
    expect(proofFor(secret, "server", a, b)).not.toBe(proofFor(secret, "server", b, a));
    expect(proofFor(secret, "server", a, b)).toBe(proofFor(secret, "server", a, b));
  });

  it("makes nonces, secrets and key ids of the agreed shape", () => {
    expect(newNonce()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSecret()).toMatch(/^[0-9a-f]{64}$/);
    expect(newKeyId()).toMatch(/^[0-9a-f]{16}$/);
    expect(newNonce()).not.toBe(newNonce());
  });

  it("compares proofs", () => {
    expect(proofEquals("ab", "ab")).toBe(true);
    expect(proofEquals("ab", "ac")).toBe(false);
    expect(proofEquals("ab", "abc")).toBe(false);
  });
});
