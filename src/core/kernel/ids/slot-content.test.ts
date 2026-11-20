import { describe, expect, it } from "vitest";
import { SlotContent } from "@/core/kernel/ids/slot-content.ts";

// T-170, K-030, FX-033: Figma gives no flag, only the id shape tells a slot's default content from what was put in.
describe("SlotContent", () => {
  const slots = new SlotContent();

  it("takes I<instance>;<id in the component> under a slot for the component's default content", () => {
    expect(slots.isDefault("I1:2;3:4", "I1:2;3:3")).toBe(true);
  });

  it("takes a layer put in (a plain id) and an owned slot's layers (<slot id>;<id>) as the instance's own", () => {
    expect(slots.isDefault("7:7", "I1:2;3:3")).toBe(false);
    expect(slots.isDefault("I1:2;3:3;7:7", "I1:2;3:3")).toBe(false);
  });
});
