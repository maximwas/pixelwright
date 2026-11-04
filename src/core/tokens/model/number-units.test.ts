import { describe, expect, it } from "vitest";
import { NumberUnits } from "@/core/tokens/model/number-units.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

type RawVariable = RawTokens["variables"][number];

const number = (
  id: string,
  scopes: string[],
  value: unknown,
): RawVariable => ({
  id,
  name: id,
  collectionId: "C:1",
  resolvedType: "FLOAT",
  scopes,
  valuesByMode: { "M:1": value },
});

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

const units = new NumberUnits();

describe("a number variable's unit (K-003, B-057)", () => {
  it("takes the unit of the scoped tokens pointing at an unscoped primitive, else px", () => {
    const found = units.units([
      number("weight/700", [], 700),
      number("font-weight/bold", ["FONT_WEIGHT"], alias("weight/700")),
      number("opacity/40", ["ALL_SCOPES"], 40),
      number("opacity/muted", ["OPACITY"], alias("opacity/40")),
      number("space/8", [], 8),
      number("gap/s", ["GAP"], alias("space/8")),
      number("lone", [], 12),
      number("count", ["TEXT_CONTENT"], 3),
    ]);

    expect(Object.fromEntries(found)).toEqual({
      "weight/700": "number",
      "font-weight/bold": "number",
      "opacity/40": "opacity",
      "opacity/muted": "opacity",
      "space/8": "px",
      "gap/s": "px",
      lone: "px",
      count: "number",
    });
  });

  it("keeps px for a primitive that a length and a font weight both point at", () => {
    const found = units.units([
      number("four", [], 4),
      number("gap", ["GAP"], alias("four")),
      number("weight", ["FONT_WEIGHT"], alias("four")),
    ]);

    expect(found.get("four")).toBe("px");
  });
});
