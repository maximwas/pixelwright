import { describe, expect, it } from "vitest";
import { breakpointsOf } from "../src/index.ts";

const screen = (id: string, name: string, width: number, children: string[]) => ({
  id,
  name,
  width,
  height: 900,
  children,
});

describe("breakpoints_find", () => {
  it("finds the same screen at other widths by its name without size words and its sections", () => {
    const found = breakpointsOf({
      target: screen("1:1", "Home – Desktop 1440", 1440, ["Header", "Hero", "Services", "Footer"]),
      screens: [
        screen("1:2", "Home / Mobile", 375, ["Header", "Hero", "Services", "Footer"]),
        screen("1:3", "About – Desktop", 1440, ["Header", "Team", "Footer"]),
        screen("1:4", "home tablet (768px)", 768, ["Header", "Hero", "Footer"]),
      ],
    });

    expect(found.widths.map(({ id, width }) => [id, width])).toEqual([
      ["1:2", 375],
      ["1:4", 768],
      ["1:1", 1440],
    ]);
    expect(found.widths.find((match) => match.id === "1:1")?.this).toBe(true);
  });
});
