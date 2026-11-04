import { describe, expect, it } from "vitest";
import { Fingerprint } from "@/core/diff/fingerprint.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const RED = { type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0 } };

function icon(fields: Partial<ReadLayer> & Pick<ReadLayer, "id" | "name">): ReadLayer {
  return {
    type: "VECTOR",
    visible: true,
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    childCount: 0,
    fills: [RED],
    pathHash: "path-a",
    ...fields,
  };
}

describe("Fingerprint", () => {
  // K-052: an asset's file follows the layer's name and place; what draws it does not.
  it("calls two copies of one icon the same though their names, places and asset files differ", () => {
    const fingerprint = new Fingerprint();
    const copy = icon({
      id: "20:3",
      name: "flask copy",
      x: 400,
      y: 12,
      renderBounds: { x: 399, y: 11, width: 26, height: 26 },
      exportSettings: [{ format: "SVG" }],
      href: "https://example.com",
    });

    expect(fingerprint.same(icon({ id: "10:3", name: "flask" }), copy)).toBe(true);
    expect(
      fingerprint.same(icon({ id: "10:3", name: "flask" }), icon({ id: "20:3", name: "flask", pathHash: "path-b" })),
    ).toBe(false);
  });
});
