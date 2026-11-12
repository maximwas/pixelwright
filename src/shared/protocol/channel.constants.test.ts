import { describe, expect, it } from "vitest";
import { CHANNEL, CHANNELS } from "@/shared/protocol/channel.constants.ts";

describe("the build channel", () => {
  it("is the release channel: 0.8.0 is released from this branch, and the next version's branch builds dev", () => {
    expect(CHANNEL).toBe(CHANNELS.release);
  });

  it("shares no value with the release channel, so a dev build never touches 0.7.0's port, home or plugin", () => {
    const release = new Set<unknown>(Object.values(CHANNELS.release));

    expect(Object.values(CHANNELS.dev).filter((value) => release.has(value))).toEqual([]);
  });
});
