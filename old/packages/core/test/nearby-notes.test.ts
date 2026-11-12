import { describe, expect, it } from "vitest";
import { nearbyNotes } from "../src/index.ts";

const SCREEN = {
  x: 0,
  y: 0,
  width: 1440,
  height: 900,
};

describe("notes near a screen", () => {
  it("keeps the notes within the distance, nearest first, with the side each one is on", () => {
    expect(
      nearbyNotes(
        SCREEN,
        [
          {
            id: "1:1",
            name: "Hover",
            box: {
              x: 1540,
              y: 100,
              width: 200,
              height: 40,
            },
            text: "Cards lift on hover.",
          },
          {
            id: "1:2",
            name: "Old idea",
            box: {
              x: 3000,
              y: 0,
              width: 100,
              height: 20,
            },
            text: "Try a carousel?",
          },
          {
            id: "1:3",
            name: "Copy",
            box: {
              x: 200,
              y: -80,
              width: 300,
              height: 30,
            },
            text: "Copy is final.",
          },
          {
            id: "1:4",
            name: "Redline",
            box: {
              x: 600,
              y: 400,
              width: 200,
              height: 20,
            },
            text: "24 between cards",
          },
          {
            id: "1:5",
            name: "Corner",
            box: {
              x: 1500,
              y: 950,
              width: 100,
              height: 30,
            },
            text: "Footer stays dark.",
          },
        ],
        {
          distance: 400,
          max: 20,
        },
      ),
    ).toEqual({
      notes: [
        {
          id: "1:4",
          name: "Redline",
          text: "24 between cards",
          side: "over",
          distance: 0,
        },
        {
          id: "1:3",
          name: "Copy",
          text: "Copy is final.",
          side: "above",
          distance: 50,
        },
        {
          id: "1:5",
          name: "Corner",
          text: "Footer stays dark.",
          side: "right",
          distance: 78.1,
        },
        {
          id: "1:1",
          name: "Hover",
          text: "Cards lift on hover.",
          side: "right",
          distance: 100,
        },
      ],
      more: 0,
    });
  });

  it("puts a note touching the screen's edge on that side, not over it", () => {
    expect(
      nearbyNotes(
        SCREEN,
        [
          {
            id: "3:1",
            name: "Edge",
            box: {
              x: 1440,
              y: 100,
              width: 200,
              height: 40,
            },
            text: "Starts where the screen ends.",
          },
        ],
        {
          distance: 400,
          max: 20,
        },
      ).notes,
    ).toMatchObject([
      {
        side: "right",
        distance: 0,
      },
    ]);
  });

  it("lists at most max, and says how many more there are", () => {
    const candidates = [10, 20, 30].map((gap, index) => ({
      id: `2:${index}`,
      name: "Note",
      box: {
        x: 1440 + gap,
        y: 0,
        width: 10,
        height: 10,
      },
      text: `Note ${index}`,
    }));

    expect(
      nearbyNotes(SCREEN, candidates, {
        distance: 400,
        max: 2,
      }),
    ).toMatchObject({
      notes: [{ id: "2:0" }, { id: "2:1" }],
      more: 1,
    });
  });
});
