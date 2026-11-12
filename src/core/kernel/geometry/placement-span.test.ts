import { describe, expect, it } from "vitest";
import { PlacementSpan } from "@/core/kernel/geometry/placement-span.ts";

const spans = new PlacementSpan();

describe("PlacementSpan", () => {
  // C-053: where a placed layer starts on its live parent's axis, and how long it is there.
  it("turns each placement into a start and a size on the parent", () => {
    expect(spans.on({ kind: "MIN", offset: 10 }, 100, 20)).toEqual({ start: 10, size: 20 });
    expect(spans.on({ kind: "MAX", offset: 10 }, 100, 20)).toEqual({ start: 70, size: 20 });
    expect(spans.on({ kind: "CENTER", offset: -5 }, 100, 20)).toEqual({ start: 45, size: 20 });
    expect(spans.on({ kind: "STRETCH", start: 10, end: 20 }, 100, 5)).toEqual({ start: 10, size: 70 });
    expect(spans.on({ kind: "SCALE", start: 10, size: 50 }, 200, 5)).toEqual({ start: 20, size: 100 });
  });
});
