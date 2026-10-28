import { describe, expect, it } from "vitest";
import { LINK_TEXT } from "@/plugin-ui/link/stop-reasons/stop-reasons.constants.ts";
import { StopReasons } from "@/plugin-ui/link/stop-reasons/stop-reasons.ts";

describe("StopReasons, the close table", () => {
  it.each([
    [4426, "protocol 5 required", "retry", LINK_TEXT.olderServer],
    [4426, "protocol 7 required", "stop", LINK_TEXT.update],
    [4426, "something else", "stop", LINK_TEXT.update],
    [4409, "", "stop", LINK_TEXT.superseded],
    [4401, "the plugin could not prove its key", "retry", LINK_TEXT.unproven],
    [4429, "too many plugin sessions", "retry", LINK_TEXT.tooManySessions],
    [4408, "waited too long for the pairing code", "retry", LINK_TEXT.helloTimeout],
    [1001, "", "retry", null],
    [1011, "the key could not be stored", "retry", null],
    [4400, "invalid message", "retry", null],
    [4410, "", "retry", null],
    [1006, "", "retry", null],
  ])("after %i %j: %s", (code, reason, action, text) => {
    expect(new StopReasons().decide(code, reason)).toEqual({
      action,
      text,
    });
  });
});
