import { describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const box = (x: number, y: number, width: number, height: number) => ({
  absoluteBoundingBox: {
    x,
    y,
    width,
    height,
  },
});

const text = (id: string, name: string, characters: string, at: ReturnType<typeof box>) => ({
  id,
  type: "TEXT",
  name,
  characters,
  ...at,
});

/**
 * A home screen with notes around it on the page: a text, a spec frame of two lines, a sticky note, and what is no
 * note: a button left on the canvas, a hidden draft, another screen of thirty texts, a text far away, a toast with an
 * icon, a row holding a chip, a hero handed over for development and a card with a photo (designs of their own, small
 * as some are).
 */
const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Home",
        ...box(0, 0, 1440, 900),
        children: [
          {
            id: "1:2",
            name: "Hero",
            ...box(0, 0, 1440, 400),
            children: [text("1:3", "Title", "Inside the design", box(40, 40, 400, 60))],
          },
        ],
      },
      text("2:1", "Note", "Hero image loops.", box(1500, 40, 200, 20)),
      {
        id: "2:2",
        name: "Spec",
        ...box(0, 960, 400, 80),
        children: [
          text("2:3", "Line 2", "then fades in.", box(0, 1000, 200, 20)),
          text("2:4", "Line 1", "The title types itself,", box(0, 970, 200, 20)),
        ],
      },
      {
        id: "2:5",
        type: "INSTANCE",
        name: "Sticky note",
        ...box(-300, 0, 200, 200),
        children: [text("2:6", "Text", "Ask legal about the footer.", box(-290, 10, 180, 40))],
      },
      {
        id: "2:7",
        type: "INSTANCE",
        name: "Button",
        ...box(1500, 300, 120, 40),
        children: [text("2:8", "Label", "Sign up", box(1510, 310, 100, 20))],
      },
      {
        ...text("2:9", "Draft", "Old copy", box(1500, 500, 200, 20)),
        visible: false,
      },
      {
        id: "3:1",
        name: "About",
        ...box(1600, 0, 1440, 900),
        children: Array.from({ length: 30 }, (_, index) =>
          text(`3:${index + 2}`, `Line ${index}`, `About ${index}`, box(1640, 40 + index * 24, 300, 20)),
        ),
      },
      text("4:1", "Far", "Try a carousel?", box(5000, 0, 200, 20)),
      {
        id: "5:1",
        name: "Toast",
        ...box(1500, 600, 240, 48),
        children: [
          {
            id: "5:2",
            type: "VECTOR",
            name: "Icon",
            ...box(1512, 612, 24, 24),
          },
          text("5:3", "Message", "Saved", box(1544, 614, 100, 20)),
        ],
      },
      {
        id: "5:4",
        name: "Row",
        ...box(1500, 700, 240, 48),
        children: [
          {
            id: "5:5",
            type: "INSTANCE",
            name: "Chip",
            ...box(1500, 700, 80, 32),
            children: [text("5:6", "Label", "New", box(1510, 706, 60, 20))],
          },
        ],
      },
      {
        id: "6:1",
        name: "Hero – B",
        devStatus: { type: "READY_FOR_DEV" },
        ...box(0, 1100, 1200, 360),
        children: [text("6:2", "Title", "Pricing for teams", box(0, 1100, 600, 60))],
      },
      {
        id: "6:3",
        name: "Card",
        ...box(-300, 300, 200, 200),
        children: [
          {
            id: "6:4",
            type: "RECTANGLE",
            name: "Photo",
            fills: [
              {
                type: "IMAGE",
                imageHash: "abc",
                scaleMode: "FILL",
                visible: true,
                opacity: 1,
              },
            ],
            ...box(-300, 300, 200, 120),
          },
          text("6:5", "Caption", "A planet", box(-300, 430, 200, 20)),
        ],
      },
    ],
  });

describe("nearby", () => {
  it("finds the designer's notes on the canvas around the screen that holds a layer, nearest first", async () => {
    installFigma(page());

    expect(
      await plugin.run("nearby", {
        node: "1:3",
        distance: 400,
      }),
    ).toEqual({
      screen: {
        id: "1:1",
        name: "Home",
      },
      notes: [
        {
          id: "2:1",
          name: "Note",
          text: "Hero image loops.",
          side: "right",
          distance: 60,
        },
        {
          id: "2:2",
          name: "Spec",
          text: "The title types itself,\nthen fades in.",
          side: "below",
          distance: 60,
        },
        {
          id: "2:5",
          name: "Sticky note",
          text: "Ask legal about the footer.",
          side: "left",
          distance: 100,
        },
      ],
      more: 0,
    });
  });
});
