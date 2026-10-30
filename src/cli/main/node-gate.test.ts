import { describe, expect, it } from "vitest";
import { NodeGate } from "@/cli/main/node-gate.ts";

describe("NodeGate", () => {
  it("refuses Node 22 with what it needs and what it found, and lets 24.11.0 and newer through (S-057)", () => {
    const gate = new NodeGate();

    expect(gate.refusal("22.12.0")).toBe("Pixelwright needs Node.js 24.11.0 or newer; you have 22.12.0.\n");
    expect(gate.refusal("24.10.9")).not.toBeNull();
    expect(gate.refusal("24.11.0")).toBeNull();
    expect(gate.refusal("25.1.0")).toBeNull();
  });
});
