import { describe, expect, it, vi } from "vitest";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import { StepGeometry } from "@/plugin/operations/apply/writers/geometry/step-geometry.ts";
import { ChildStep } from "@/plugin/operations/apply/writers/layout/child-step.ts";
import { StepValues } from "@/plugin/operations/apply/writers/step-values.ts";
import { INTENT_SELF_ALIGN } from "@/shared/write-intents/write-intent.constants.ts";

const variable = { id: "VariableID:2:2" };

/** A rectangle in a horizontal auto layout, its width and height bound to a number variable. */
function bound() {
  return {
    type: "RECTANGLE",
    parent: { type: "FRAME", layoutMode: "HORIZONTAL" },
    width: 10,
    height: 10,
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    boundVariables: { width: variable, height: variable },
    setBoundVariable: vi.fn(),
  };
}

function build() {
  return new ChildStep(new Assign(), new StepGeometry(new Assign()), new StepValues({} as never, new Assign()));
}

describe("ChildStep", () => {
  it("takes the variable off the width a flex grow fills", () => {
    const node = bound();

    build().write(node as never, { grow: true });

    expect(node.layoutSizingHorizontal).toBe("FILL");
    expect(node.setBoundVariable).toHaveBeenCalledWith("width", null);
    expect(node.setBoundVariable).not.toHaveBeenCalledWith("height", null);
  });

  it("takes the variable off the height an align-self stretch fills", () => {
    const node = bound();

    build().write(node as never, { alignSelf: INTENT_SELF_ALIGN.STRETCH });

    expect(node.setBoundVariable).toHaveBeenCalledWith("height", null);
  });

  it("leaves the variable where a layer stops filling", () => {
    const node = bound();

    build().write(node as never, { grow: false });

    expect(node.setBoundVariable).not.toHaveBeenCalled();
  });
});
