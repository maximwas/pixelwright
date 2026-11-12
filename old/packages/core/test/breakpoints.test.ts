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

describe("breakpoints_find after the review", () => {
  it("matches screens named only by their size, by their children", () => {
    const found = breakpointsOf({
      target: screen("2:1", "Desktop", 1440, ["Header", "Hero", "Footer"]),
      screens: [screen("2:2", "Mobile", 375, ["Header", "Hero", "Footer"]), screen("2:3", "1440", 1440, ["Header"])],
    });

    expect(found.widths.map(({ id }) => id)).toEqual(["2:2", "2:1"]);
  });

  it("leaves out a state of the screen at its own width", () => {
    const found = breakpointsOf({
      target: screen("3:1", "Home / Desktop", 1440, ["Header", "Hero"]),
      screens: [screen("3:2", "Home / Desktop – menu open", 1440, ["Header", "Hero"])],
    });

    expect(found.widths.map(({ id }) => id)).toEqual(["3:1"]);
  });
});
