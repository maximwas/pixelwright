import { describe, expect, it } from "vitest";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";

// No Figma here (CLAUDE.md): a component is plain data; the typings allow variantProperties to be null (P-084).
function variant(name: string, variantProperties: Record<string, string> | null): ComponentNode {
  return { name, variantProperties } as ComponentNode;
}

describe("Variants.values", () => {
  it("gives the values Figma gives", () => {
    expect(new Variants().values(variant("x", { Size: "Large" }))).toEqual({ Size: "Large" });
  });

  it("reads them from the variant's name when Figma gives none", () => {
    expect(new Variants().values(variant("Size=Large, State=Default", null))).toEqual({
      Size: "Large",
      State: "Default",
    });
  });

  it("has none for a name that holds no pair", () => {
    expect(new Variants().values(variant("Button", null))).toEqual({});
  });
});
