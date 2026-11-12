import { describe, expect, it } from "vitest";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";

const vars = new CssVar(new CssSplit());

// C-017: Figma wraps a style as var(--Name, fallback); design_read writes the bare var.
describe("CssVar", () => {
  it("drops var() fallbacks whole, commas and parentheses inside them included, and comments", () => {
    expect(vars.withoutFallbacks("var(--Overlay, rgba(0, 0, 0, 0.50))")).toBe("var(--Overlay)");
    expect(vars.withoutFallbacks("0 4px 8px 0 var(--Shadow, rgba(0, 0, 0, 0.1)) /* note */")).toBe(
      "0 4px 8px 0 var(--Shadow)",
    );
  });

  it("names a value's token, and puts the tokens' values in; a token that names itself stays a var()", () => {
    expect(vars.token(" var(--space-8, 8px) ")).toEqual({ token: "--space-8" });
    expect(vars.token("8px")).toBeNull();
    expect(vars.resolved("var(--a) var(--b, 2px) var(--c)", { "--a": "var(--b)", "--b": "1px" })).toBe(
      "1px 1px var(--c)",
    );
    expect(vars.resolved("var(--loop)", { "--loop": "var(--loop)" })).toBe("var(--loop)");
  });
});
