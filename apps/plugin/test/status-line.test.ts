import { describe, expect, it } from "vitest";
import { pairingNote, statusLine } from "../src/view/status-line.ts";

describe("the window's texts", () => {
  it("asks for the code while pairing, and says why a code did not work", () => {
    expect(
      statusLine(
        {
          kind: "pairing",
          reason: "no_key",
          attemptsLeft: 5,
        },
        "Positivus",
      ).text,
    ).toBe("Pair this plugin with Pixelwright");
    expect(
      pairingNote({
        kind: "pairing",
        reason: "no_key",
        attemptsLeft: 5,
      }),
    ).toBe("Ask your AI assistant for the pairing code (it is in status) and type it here.");
    expect(
      pairingNote({
        kind: "pairing",
        reason: "wrong_code",
        attemptsLeft: 3,
      }),
    ).toBe("Wrong code: 3 tries left.");
    expect(
      pairingNote({
        kind: "pairing",
        reason: "wrong_code",
        attemptsLeft: 0,
      }),
    ).toBe("Too many wrong codes: ask your assistant for the new code.");
    expect(
      pairingNote({
        kind: "pairing",
        reason: "expired",
        attemptsLeft: 5,
      }),
    ).toBe("That code expired: ask your assistant for the new one.");
    expect(
      pairingNote({
        kind: "pairing",
        reason: "unknown_key",
        attemptsLeft: 5,
      }),
    ).toBe("Pixelwright no longer knows this plugin: ask your assistant for a pairing code and type it here.");
    expect(
      pairingNote({
        kind: "pairing",
        reason: "locked",
        attemptsLeft: 0,
      }),
    ).toBe(
      "Too many wrong codes were typed, maybe by another program: pairing is paused. Ask your assistant again in a few minutes.",
    );
    expect(
      pairingNote({
        kind: "connected",
        serverVersion: "0.1.0",
      }),
    ).toBeNull();
  });

  it("says why it is waiting when it knows", () => {
    expect(
      statusLine(
        {
          kind: "waiting",
          retryInMs: 500,
          reason: "The program could not prove it.",
        },
        "x",
      ).text,
    ).toBe("The program could not prove it.");
  });
});
