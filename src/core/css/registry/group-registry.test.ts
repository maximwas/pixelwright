import { describe, expect, it } from "vitest";
import type { PropertyGroup } from "@/core/css/css.types.ts";
import { GroupRegistry } from "@/core/css/registry/group-registry.ts";

function group(attributes: readonly string[]): PropertyGroup {
  return { attributes, sources: [], read: () => undefined };
}

describe("GroupRegistry", () => {
  // C-172: each CSS attribute has one group, so a write rule and a plugin error name one owner.
  it("refuses two groups that own the same attribute", () => {
    expect(() => new GroupRegistry([group(["gap", "padding"]), group(["opacity", "gap"])])).toThrow(/gap/);
  });
});
