import { describe, expect, it } from "vitest";
import { TokenNames } from "@/core/kernel/names/token-names.ts";

const names = new TokenNames();

// T-163, C-021, K-070: names as Dev Mode writes them, any script kept, a name without letters or digits hashed.
describe("token names", () => {
  it("keep letters and digits of any script and turn every other run into one dash", () => {
    expect(names.token("a/b c")).toBe("--a-b-c");
    expect(names.token(" Колір / основний ")).toBe("--Колір-основний");
  });

  it("give a name with no letters or digits its FNV-1a hash in base 36", () => {
    expect(names.token("★★")).toBe("--token-197cz33");
  });

  it("take a variable's WEB code syntax over its name", () => {
    expect(names.variable({ name: "color/surface", codeSyntax: { WEB: "var(--surface, #fff)" } })).toBe("--surface");
    expect(names.variable({ name: "color/surface", codeSyntax: { WEB: "brand" } })).toBe("--brand");
    expect(names.variable({ name: "space/4", codeSyntax: { iOS: "space4" } })).toBe("--space-4");
  });

  it("number a style that shares its name, in its token and in the name the XML writes", () => {
    expect(names.style({ name: "Black", duplicate: 2 })).toBe("--Black-2");
    expect(names.style({ name: "Black" })).toBe("--Black");
    expect(names.styleName({ name: "h1", duplicate: 2 })).toBe("h1-2");
  });

  it("find the variable an alias binds to a field", () => {
    const bound = { paddingLeft: { type: "VARIABLE_ALIAS", id: "V:1" } };

    expect(names.alias(bound, "paddingLeft")).toBe("V:1");
    expect(names.alias(bound, "paddingTop")).toBeUndefined();
    expect(names.alias(undefined, "paddingTop")).toBeUndefined();
  });
});
