import { describe, expect, it } from "vitest";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";

const reader = new ApplyRead();

function errorsOf(xml: string) {
  return reader.read(xml).errors;
}

// T-137 and C-163: each refusal in its rule's order, with the words 0.7.0 gave.
describe("attribute refusals", () => {
  it("turns an agent's habit into the CSS that says it", () => {
    expect(errorsOf('<Frame x="10"/>')[0]).toMatchObject({
      attribute: "x",
      hint: 'Write position="absolute" left="10px": CSS places a layer by left and top.',
    });
  });

  it("says Did you mean for a misspelt attribute, with the line and column", () => {
    expect(errorsOf('<Frame heigth="10"/>')).toEqual([
      {
        line: 1,
        column: 1,
        attribute: "heigth",
        message: "heigth is not an attribute of <Frame>: left out.",
        hint: "Did you mean height?",
      },
    ]);
  });

  const refusals: [string, string, string][] = [
    ["a Page takes only a name", '<Page width="1px"/>', "A <Page> takes only a name: width is not written."],
    [
      "a property outside a component",
      '<Frame prop="x"/>',
      "prop makes a property of the <Component> holding the layer: this new layer is in none.",
    ],
    [
      "display on a shape",
      '<Rectangle display="flex"/>',
      "A <Rectangle> has no auto layout: display takes none (hidden) or block here.",
    ],
    ["layout on a shape", '<Rectangle gap="4px"/>', "gap lays out a frame's children: a <Rectangle> has none."],
    ["text attributes on a frame", '<Frame font="12px Inter"/>', "font styles a text: a <Frame> holds none."],
    [
      "path attributes off a TextPath",
      '<Text d="M 0 0">a</Text>',
      "d belongs to a text on a path: a <Text> has no path.",
    ],
    [
      "box paint on a Text",
      '<Text background="#fff">a</Text>',
      "A <Text> has no box to paint: background is not written on it.",
    ],
    ["paint on a Group", '<Group id="1:1" background="#fff"/>', "A <Group> has no background."],
    ["overflow on a shape", '<Rectangle overflow="hidden"/>', "A <Rectangle> holds no layers to clip."],
  ];

  it.each(refusals)("refuses %s", (_name, xml, message) => {
    expect(errorsOf(xml).map((error) => error.message)).toContain(message);
  });
});

// D-67 / O-020+r: 0.7.0 found each element's line linearly (20,000 lines took 6 s); a quadratic read grows ~400x for 20x.
describe("ApplyRead speed", () => {
  const timeOf = (rows: number): number => {
    const body = Array.from(
      { length: rows },
      (_value, row) => `\n  <Text id="2:${row}" name="n${row}">row ${row}</Text>`,
    );
    const xml = `<Frame id="1:1">${body.join("")}\n</Frame>`;
    let fastest = Number.POSITIVE_INFINITY;

    for (let run = 0; run < 5; run += 1) {
      const start = performance.now();

      reader.read(xml);
      fastest = Math.min(fastest, performance.now() - start);
    }

    return fastest;
  };

  it("reads 20x the lines in far less than 400x the time", () => {
    timeOf(100);

    expect(timeOf(20_000) / Math.max(timeOf(1_000), 0.5)).toBeLessThan(100);
  });
});
