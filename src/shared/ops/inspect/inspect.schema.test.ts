import { describe, expect, it } from "vitest";
import { INSPECT_PARENT_LAYOUT_KEYS } from "@/shared/ops/inspect/inspect.constants.ts";
import { InspectOpOutputSchema } from "@/shared/ops/inspect/inspect.schema.ts";

describe("inspect op output", () => {
  it("keeps in a layer's parentLayout exactly the keys the plugin reads (and the child count)", () => {
    const layer = InspectOpOutputSchema.shape.layers.def.element;
    const kept = Object.keys(layer.shape.parentLayout.def.innerType.shape).filter((key) => key !== "childCount");

    expect(kept.sort()).toEqual([...INSPECT_PARENT_LAYOUT_KEYS].sort());
    expect(INSPECT_PARENT_LAYOUT_KEYS).toHaveLength(17);
  });
});
