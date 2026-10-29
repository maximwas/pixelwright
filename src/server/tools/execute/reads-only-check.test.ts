import { describe, expect, it } from "vitest";
import { ReadsOnlyCheck } from "@/server/tools/execute/reads-only-check.ts";

// The note may be missing, never wrong (D-38): any sign of a write says no.
describe("ReadsOnlyCheck (T-153)", () => {
  it("says code that only finds and reads layers only reads", () => {
    const code =
      'const texts = figma.currentPage.findAll((node) => node.type === "TEXT");\nreturn texts.map((text) => text.characters);';

    expect(new ReadsOnlyCheck().readsOnly(code)).toBe(true);
  });

  it("says no for code that assigns to any property", () => {
    const code = 'figma.currentPage.findAll((node) => node.type === "TEXT")[0].characters = "x";';

    expect(new ReadsOnlyCheck().readsOnly(code)).toBe(false);
  });
});
