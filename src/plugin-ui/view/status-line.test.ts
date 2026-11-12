import { describe, expect, it } from "vitest";
import { StatusLine } from "@/plugin-ui/view/status-line.ts";

const status = new StatusLine();

describe("StatusLine (P-050)", () => {
  it.each([
    [
      { kind: "connecting" },
      { tone: "wait", title: "Connecting…", detail: "Looking for Pixelwright on this computer.", note: null },
    ],
    [
      { kind: "connected" },
      { tone: "ok", title: "Connected (Test MCP)", detail: "Your AI assistant sees this file.", note: null },
    ],
    [
      { kind: "pairing", reason: "no_key", attemptsLeft: 5 },
      {
        tone: "wait",
        title: "Pair this window",
        detail: null,
        note: "Ask your AI assistant for the 6-digit pairing code and type it here.",
      },
    ],
    [
      { kind: "waiting", retryInMs: 500, reason: null },
      {
        tone: "wait",
        title: "Not connected",
        detail: "Start Claude Code, Cursor or another AI app with Pixelwright. This window connects by itself.",
        note: null,
      },
    ],
    [
      { kind: "stopped", reason: "Update the plugin." },
      { tone: "error", title: "Stopped", detail: "Update the plugin.", note: null },
    ],
  ] as const)("words the link while %o", (state, line) => {
    expect(status.line(state, "Test MCP", null)).toEqual(line);
  });

  // A§15.10: the busy state of D-06 is the status line's sentence, no redesign.
  it("puts an op still running past its answer in the sentence, its dot waiting", () => {
    expect(status.line({ kind: "connected" }, "Test MCP", "Busy: execute since 35 s")).toEqual({
      tone: "wait",
      title: "Connected (Test MCP)",
      detail: "Busy: execute since 35 s",
      note: null,
    });
  });

  it("says under the switch what Allow edits lets the AI do, and that execute's code outlives it (P-053, P-012)", () => {
    expect(status.editsNote(true, false, "⌘Z")).toBe(
      "AI may change this file until you turn this off, also in later sessions on this computer. Each change is one undo step (⌘Z).",
    );
    expect(status.editsNote(false, false, "⌘Z")).toBe("AI only reads this file.");
    expect(status.editsNote(false, true, "⌘Z")).toBe(
      "AI only reads this file now. Code it ran with execute keeps running until you close this window.",
    );
  });

  it("asks for Allow edits after a refused write, only while it is off (P-012)", () => {
    expect(status.editsHint(true, false)).toBe("Your AI tried to change this file: turn on Allow edits.");
    expect(status.editsHint(true, true)).toBeNull();
    expect(status.editsHint(false, false)).toBeNull();
  });
});
