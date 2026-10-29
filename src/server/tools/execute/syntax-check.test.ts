import { describe, expect, it } from "vitest";
import { SyntaxCheck } from "@/server/tools/execute/syntax-check.ts";

describe("SyntaxCheck (T-152)", () => {
  it("passes code that parses as the body of execute's async function", () => {
    expect(new SyntaxCheck().problem("const page = figma.currentPage;\nreturn await page.name;")).toBeNull();
  });

  it("points at the code's own line and column, the wrapper's line taken off, and quotes the line", () => {
    expect(new SyntaxCheck().problem("const a = 1;\nconst b = ;\nreturn a;")).toBe(
      "SyntaxError: Unexpected token ';'\n    at line 2, column 11\nline 2: const b = ;",
    );
  });

  it("says the code may have arrived cut when it breaks off at its very end (B-006)", () => {
    const code = 'const plan = {\n  name: "Pro",';

    expect(new SyntaxCheck().problem(code)).toContain(
      `The code ends there, after ${code.length} characters: if you sent more, the rest was cut on its way to Pixelwright`,
    );
  });
});
