import { describe, expect, it } from "vitest";
import { Slug } from "@/core/kernel/names/slug.ts";

const slug = new Slug();

// K-075: asset file names from layer names.
describe("slug", () => {
  it("parts words at every run of anything but letters, digits and marks, lower case", () => {
    expect(slug.of("tokyo-magnifier 2")).toBe("tokyo-magnifier-2");
    expect(slug.of("State=Default")).toBe("state-default");
    expect(slug.of("Kid's ﬁle")).toBe("kids-file");
  });

  it("transliterates Cyrillic by the Ukrainian rules", () => {
    expect(slug.of("Логотип компанії")).toBe("lohotyp-kompaniyi");
  });

  it("keeps 60 characters without a trailing dash, and names an empty one asset", () => {
    expect(slug.of(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
    expect(slug.of("a".repeat(80))).toHaveLength(60);
    expect(slug.of("")).toBe("asset");
    expect(slug.of("— ★ —")).toBe("asset");
  });
});
