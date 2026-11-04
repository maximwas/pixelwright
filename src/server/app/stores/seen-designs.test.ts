import { describe, expect, it } from "vitest";
import { type SeenDesign, SeenDesigns } from "@/server/app/stores/seen-designs.ts";

const DESIGN: SeenDesign = {
  name: "pricing",
  node: { id: "1:1", name: "Pricing", type: "FRAME" },
  file: { name: "Test MCP", key: null },
  page: null,
  plugin: "0.8.0",
  snapshot: {
    model: 1,
    profile: "design",
    root: {
      id: "1:1",
      name: "Pricing",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      childCount: 0,
    },
    styles: {},
    variables: {},
  },
  tokens: null,
  capturedAt: "2026-11-04T10:00:00.000Z",
  baselineCapturedAt: "2026-11-04T09:12:04.512Z",
};

describe("the designs one-baseline diffs compared", () => {
  it("keeps the last eight in memory under random 16-hex ids (T-202, D-39)", () => {
    const seen = new SeenDesigns();
    const ids = Array.from({ length: 9 }, (_slot, index) => seen.keep({ ...DESIGN, capturedAt: String(index) }));

    expect(ids.every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(9);
    expect(seen.get(ids[0] ?? "")).toBeUndefined();
    expect(seen.get(ids[1] ?? "")?.capturedAt).toBe("1");
    expect(seen.get(ids[8] ?? "")?.capturedAt).toBe("8");
  });
});
