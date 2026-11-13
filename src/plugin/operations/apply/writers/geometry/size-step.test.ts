import { describe, expect, it, vi } from "vitest";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import { SizeStep } from "@/plugin/operations/apply/writers/geometry/size-step.ts";
import { StepGeometry } from "@/plugin/operations/apply/writers/geometry/step-geometry.ts";
import { StepValues } from "@/plugin/operations/apply/writers/step-values.ts";

const width = { id: "VariableID:2:2" };

function build() {
  const tokens = { check: vi.fn(async () => undefined), variable: vi.fn(async () => width) };

  return new SizeStep(new Assign(), new StepValues(tokens as never, new Assign()), new StepGeometry(new Assign()));
}

function rectangle(bound: Record<string, { id: string }> = {}) {
  const node = {
    type: "RECTANGLE",
    parent: null,
    width: 10,
    height: 10,
    boundVariables: { ...bound },
    resize: vi.fn((wide: number, high: number) => Object.assign(node, { width: wide, height: high })),
    setBoundVariable: vi.fn(),
  };

  return node;
}

describe("SizeStep", () => {
  it("binds a width to the number variable its var() names", async () => {
    const node = rectangle();

    await build().write(node as never, { width: { token: "size-card" } });

    expect(node.setBoundVariable).toHaveBeenCalledWith("width", width);
    expect(node.resize).not.toHaveBeenCalled();
  });

  it("takes the variable off a bound width given a number, then resizes", async () => {
    const node = rectangle({ width: width });

    await build().write(node as never, { width: 40 });

    expect(node.setBoundVariable).toHaveBeenCalledWith("width", null);
    expect(node.width).toBe(40);
  });

  it("refuses a section sized by a token or hugging, on a dry run's check as on a real one", async () => {
    const step = build();

    await expect(step.check({ width: { token: "size-card" } }, { type: "SECTION" })).rejects.toThrow(
      "A section's size takes a number of pixels, not a token.",
    );
    await expect(step.check({ height: "HUG" }, { type: "SECTION" })).rejects.toThrow(/cannot hug/);
    await expect(step.check({ width: 200 }, { type: "SECTION" })).resolves.toBeUndefined();
  });
});
