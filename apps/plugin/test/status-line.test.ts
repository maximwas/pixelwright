import { describe, expect, it } from "vitest";
import { editsHint, editsNote, pairingNote, statusLine } from "../src/view/status-line.ts";

describe("the window's status", () => {
  it("says what to do when no server is there, and why it waits when it knows", () => {
    expect(
      statusLine(
        {
          kind: "waiting",
          retryInMs: 500,
          reason: null,
        },
        "Positivus",
      ),
    ).toEqual({
      tone: "wait",
      title: "Not connected",
      detail: "Start Claude Code, Cursor or another AI app with Pixelwright. This window connects by itself.",
    });
    expect(
      statusLine(
        {
          kind: "waiting",
          retryInMs: 500,
          reason: "The program could not prove it.",
        },
        "x",
      ).detail,
    ).toBe("The program could not prove it.");
  });

  it("names the file the AI sees once connected; what it may do with it is the switch's", () => {
    expect(
      statusLine(
        {
          kind: "connected",
          serverVersion: "0.1.0",
        },
        "Positivus",
      ),
    ).toEqual({
      tone: "ok",
      title: "Connected",
      detail: "Your AI assistant sees “Positivus”.",
    });
  });

  it("names the other states plainly", () => {
    expect(statusLine({ kind: "connecting" }, "x")).toEqual({
      tone: "wait",
      title: "Connecting…",
      detail: "Looking for Pixelwright on this computer.",
    });
    expect(
      statusLine(
        {
          kind: "pairing",
          reason: "no_key",
          attemptsLeft: 5,
        },
        "x",
      ),
    ).toEqual({
      tone: "wait",
      title: "Pair this window",
      detail: null,
    });
    expect(
      statusLine(
        {
          kind: "stopped",
          reason: "This plugin is older than the server: update it.",
        },
        "x",
      ),
    ).toEqual({
      tone: "error",
      title: "Stopped",
      detail: "This plugin is older than the server: update it.",
    });
  });

  it("says how long edits stay on and how to take them back, and asks for them after a refused write", () => {
    expect(editsNote(true, "⌘Z")).toBe(
      "AI may change this file until you close this window. Each change is one undo step (⌘Z).",
    );
    expect(editsNote(false, "⌘Z")).toBe("AI only reads this file.");
    expect(editsNote(false, "⌘Z", true)).toBe(
      "AI only reads this file now. Code it ran with execute keeps running until you close this window.",
    );
    expect(editsHint(true, false)).toBe("Your AI tried to change this file: turn on Allow edits.");
    expect(editsHint(true, true)).toBeNull();
    expect(editsHint(false, false)).toBeNull();
  });
});

describe("pairing", () => {
  it("asks for the code, and says why a code did not work", () => {
    expect(
      pairingNote({
        kind: "pairing",
        reason: "no_key",
        attemptsLeft: 5,
      }),
    ).toBe("Ask your AI assistant for the 6-digit pairing code and type it here.");
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
    ).toBe("Pixelwright no longer knows this window: ask your assistant for a pairing code and type it here.");
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
});
