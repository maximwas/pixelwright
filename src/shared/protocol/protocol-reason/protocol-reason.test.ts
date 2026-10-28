import { describe, expect, it } from "vitest";
import { ProtocolReason } from "@/shared/protocol/protocol-reason/protocol-reason.ts";

describe("ProtocolReason", () => {
  it("writes the reason as 0.7.0 did and as a 0.7.0 plugin reads it", () => {
    expect(ProtocolReason.required(6).text()).toBe("protocol 6 required");
  });

  it("reads back the protocol a reason names", () => {
    expect(ProtocolReason.parse("protocol 5 required")?.protocol).toBe(5);
    expect(ProtocolReason.parse(ProtocolReason.required(12).text())?.protocol).toBe(12);
  });

  it("reads nothing from any other close reason", () => {
    expect(ProtocolReason.parse("hello timeout")).toBeNull();
    expect(ProtocolReason.parse("peer protocol 3 required")).toBeNull();
    expect(ProtocolReason.parse(null)).toBeNull();
  });
});
