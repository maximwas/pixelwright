import { type ApplyChange, type ApplyError, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeLibrary, type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Applied {
  created: { line: number; ref: string; id: string; tag: string }[];
  changed: string[];
  errors: ApplyError[];
}

/** The changes core makes of an XML, every attribute taken as new. */
function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

const apply = async (xml: string, options: { parent?: string; dryRun?: boolean } = {}) =>
  (await plugin.run("apply", {
    changes: changesOf(xml),
    ...options,
  })) as Applied;

const DARK = {
  r: 25 / 255,
  g: 26 / 255,
  b: 35 / 255,
};

const LIBRARY: FakeLibrary = {
  fonts: [
    {
      family: "Inter",
      style: "Regular",
    },
    {
      family: "Inter",
      style: "Medium",
    },
    {
      family: "Inter",
      style: "Bold",
    },
    {
      family: "Inter",
      style: "Book",
    },
    {
      family: "Space Grotesk",
      style: "Medium",
    },
    ...["Regular", "Medium", "Semibold", "Bold"].map((style) => ({
      family: "SF Pro",
      style,
    })),
  ],
  styles: {
    "S:h3": {
      id: "S:h3",
      name: "h3",
      type: "TEXT",
      remote: true,
      fontName: {
        family: "Space Grotesk",
        style: "Medium",
      },
      fontSize: 30,
      lineHeight: { unit: "AUTO" },
      letterSpacing: {
        unit: "PIXELS",
        value: 0,
      },
      textCase: "ORIGINAL",
      textDecoration: "NONE",
    },
    "S:dark": {
      id: "S:dark",
      name: "Dark",
      type: "PAINT",
      remote: true,
      paints: [
        {
          type: "SOLID",
          color: DARK,
        },
      ],
    },
  },
};

/** A page with an auto layout card, a free-form box with a child, and a Heading instance. */
function page(): FakeNode {
  return tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        layoutMode: "HORIZONTAL",
        opacity: 1,
        fillStyleId: "S:dark",
        fills: [
          {
            type: "SOLID",
            color: DARK,
          },
        ],
        absoluteBoundingBox: {
          x: 0,
          y: 0,
          width: 600,
          height: 300,
        },
        children: [
          {
            id: "1:2",
            type: "TEXT",
            name: "Title",
            characters: "Hello",
            textAutoResize: "WIDTH_AND_HEIGHT",
            fontName: {
              family: "Inter",
              style: "Regular",
            },
          },
          {
            id: "1:3",
            name: "Side",
            layoutSizingHorizontal: "FIXED",
          },
        ],
      },
      {
        id: "3:1",
        name: "Board",
        layoutMode: "NONE",
        absoluteBoundingBox: {
          x: 1000,
          y: 0,
          width: 400,
          height: 200,
        },
        children: [
          {
            id: "3:2",
            name: "Badge",
            constraints: {
              horizontal: "MIN",
              vertical: "MIN",
            },
            absoluteBoundingBox: {
              x: 1010,
              y: 10,
              width: 100,
              height: 40,
            },
            relativeTransform: [
              [1, 0, 10],
              [0, 1, 10],
            ],
          },
        ],
      },
      {
        id: "2:1",
        name: "Heading",
        type: "INSTANCE",
        mainComponent: {
          name: "Heading",
          parent: null,
        },
        children: [
          {
            id: "I2:1;3:4",
            type: "TEXT",
            name: "Label",
            characters: "Services",
            textStyleId: "S:h3",
            fontName: {
              family: "Space Grotesk",
              style: "Medium",
            },
          },
        ],
      },
      {
        id: "2:5",
        name: "Button",
        type: "INSTANCE",
        mainComponent: {
          name: "Button",
          parent: null,
        },
        componentProperties: {
          "Label#1:0": {
            type: "TEXT",
            value: "Old",
          },
        },
        children: [
          {
            id: "I2:5;3:6",
            type: "TEXT",
            characters: "Old",
            componentPropertyReferences: { characters: "Label#1:0" },
            fontName: {
              family: "Inter",
              style: "Regular",
            },
          },
        ],
      },
      {
        id: "4:1",
        name: "Hidden panel",
        visible: false,
        layoutMode: "VERTICAL",
        itemSpacing: 8,
        children: [{ id: "4:2" }],
      },
      {
        id: "1:4",
        type: "TEXT",
        characters: "Hello world",
        fontName: {
          family: "Inter",
          style: "Regular",
        },
        segments: [
          {
            characters: "Hello ",
            start: 0,
            end: 6,
            fontName: {
              family: "Inter",
              style: "Regular",
            },
            fills: [
              {
                type: "SOLID",
                color: DARK,
              },
            ],
          },
          {
            characters: "world",
            start: 6,
            end: 11,
            fontName: {
              family: "Inter",
              style: "Regular",
            },
            fills: [
              {
                type: "SOLID",
                color: {
                  r: 1,
                  g: 0,
                  b: 0,
                },
              },
            ],
          },
        ],
      },
      {
        id: "1:6",
        type: "TEXT",
        characters: "Hi",
        fontWeight: 590,
        fontName: {
          family: "SF Pro",
          style: "Semibold",
        },
      },
      {
        id: "1:7",
        name: "Card",
        layoutMode: "VERTICAL",
        layoutSizingHorizontal: "HUG",
        layoutSizingVertical: "HUG",
      },
    ],
  });
}

let root: FakeNode;
let fake: ReturnType<typeof installFigma>;
const byId = (id: string, from: FakeNode = root): FakeNode | undefined =>
  from.id === id ? from : (from.children ?? []).map((child) => byId(id, child)).find((node) => node !== undefined);

beforeEach(() => {
  root = page();
  fake = installFigma(root, LIBRARY);
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("apply: the safety catch", () => {
  it("refuses every write while Allow edits is off, and checks without writing on a dry run", async () => {
    plugin.services.edits.allow(false);

    await expect(apply('<Frame id="1:1" opacity="0.5"/>')).rejects.toMatchObject({ code: "EDITS_DISABLED" });
    expect(byId("1:1")?.opacity).toBe(1);

    const checked = await apply(
      '<Frame id="9:9" opacity="0.5"/>\n<Text id="1:2" font="300 14px/20px \'Inter\'">x</Text>\n<Frame id="1:1" opacity="0.5"/>',
      { dryRun: true },
    );

    expect(checked.errors.map(({ line }) => line)).toEqual([1, 2]);
    expect(byId("1:1")?.opacity).toBe(1);
    expect(fake.writes.calls).toEqual([]);
    expect(fake.writes.undo).toBe(0);
  });
});

describe("apply: refusals that write nothing", () => {
  it("refuses a dashed underline before writing any of it", async () => {
    const result = await apply('<Text id="1:2" text-decoration="underline dashed"/>');

    expect(result.errors.map(({ attribute, message }) => `${attribute}: ${message}`)).toEqual([
      "text-decoration: Figma underlines solid, wavy or dotted: it has no dashed decoration.",
    ]);
    expect(byId("1:2")?.textDecoration ?? "NONE").toBe("NONE");
  });

  it("gives one error for a link on a frame", async () => {
    const result = await apply('<Frame id="1:1" href="https://example.com"/>');

    expect(result.errors.map(({ message }) => message)).toEqual([
      "A link on a frame is a prototype reaction: it is written in the next stage.",
    ]);
  });
});

describe("apply: a step that fails writes nothing", () => {
  it("resolves every value of a step before writing any, and closes the call's undo step", async () => {
    const before = byId("1:1")?.paddingTop;
    const result = await apply('<Frame id="1:1" padding="8px var(--nope)"/>');

    expect(result.errors.map(({ attribute }) => attribute)).toEqual(["padding"]);
    expect(byId("1:1")?.paddingTop).toBe(before);
    expect(fake.writes.undo).toBe(1);
  });

  it("refuses a stroke weight per side before writing the stroke's paint", async () => {
    const result = await apply('<Ellipse name="Dot" width="10px" height="10px" border-top="2px solid #000"/>', {
      parent: "3:1",
    });
    const dot = fake.writes.created.find((node) => node.type === "ELLIPSE");

    expect(result.errors.map(({ attribute }) => attribute)).toEqual(["border-top"]);
    expect(dot?.strokes ?? []).toEqual([]);
  });
});

describe("apply: a dry run finds what the real run would", () => {
  const messages = (result: Applied) => result.errors.map(({ attribute, message }) => `${attribute}: ${message}`);

  it("refuses a paint style inside a list of paints, as the real run does", async () => {
    const xml = '<Frame id="1:1" background="color-mix(in srgb, var(--Dark) 50%, transparent)"/>';
    const dry = await apply(xml, { dryRun: true });
    const real = await apply(xml);

    expect(messages(real)).toEqual([
      "background: --Dark is a paint style, which is the whole list of a layer's paints.",
    ]);
    expect(messages(dry)).toEqual(messages(real));
  });

  it("refuses for what each layer is, as the real run does: a frame's description and link, a dashed underline, a section's opacity", async () => {
    const xml = [
      '<Frame id="1:1" description="A card." href="https://example.com/pricing"/>',
      '<Text id="1:2" text-decoration="underline dashed">Hello</Text>',
      '<Section name="Notes" opacity="0.5"/>',
    ].join("\n");
    const dry = await apply(xml, { dryRun: true });
    const real = await apply(xml);

    expect(messages(real)).toEqual([
      "description: A description belongs to a component or a component set.",
      "href: A link on a frame is a prototype reaction: it is written in the next stage.",
      "text-decoration: Figma underlines solid, wavy or dotted: it has no dashed decoration.",
      "opacity: A section has no opacity.",
    ]);
    expect(messages(dry)).toEqual(messages(real));
  });

  it("gives one error for a property, as the real run's step does", async () => {
    const xml = '<Frame id="1:1" padding="8px var(--nope)"/>';
    const dry = await apply(xml, { dryRun: true });
    const real = await apply(xml);

    expect(messages(real)).toHaveLength(1);
    expect(messages(dry)).toEqual(messages(real));
  });

  it("lists the layers it would make and change, as the real run does, the new ones without ids", async () => {
    const xml = [
      '<Frame id="1:1" opacity="0.5"/>',
      '<Frame name="Card" width="10px" height="10px">',
      '  <Rectangle width="4px" height="4px"/>',
      "</Frame>",
      '<Frame id="9:9" opacity="0.5"/>',
    ].join("\n");
    const dry = await apply(xml, { dryRun: true });
    const real = await apply(xml);

    expect(dry.created.map(({ line, tag }) => `${line} ${tag}`)).toEqual(["2 Frame", "3 Rectangle"]);
    expect(dry.created.some((made) => "id" in made)).toBe(false);
    expect(dry.created).toEqual(
      real.created.map(({ line, ref, tag }) => ({
        line,
        ref,
        tag,
      })),
    );
    expect(dry.changed).toEqual(["1:1"]);
    expect(dry.changed).toEqual(real.changed);
  });
});

describe("apply: new component sets", () => {
  it("places a new set on the page beside what is there, as any new layer", async () => {
    const placed = async (xml: string) => {
      root = tree({
        id: "0:1",
        type: "PAGE",
        name: "Page 1",
        children: [
          {
            id: "1:1",
            name: "Card",
            x: 0,
            y: 20,
            width: 600,
            height: 300,
          },
          {
            id: "3:1",
            name: "Board",
            x: 1000,
            y: 0,
            width: 400,
            height: 200,
          },
        ],
      });
      fake = installFigma(root, LIBRARY);

      const result = await apply(xml);
      // A set is made last, once its variants are: the first layer the XML names is its own.
      const made = byId(result.created.find(({ line, ref }) => line === 1 && ref === "new:1")?.id ?? "");

      expect(result.errors).toEqual([]);

      return [made?.x, made?.y];
    };

    expect(await placed('<Frame name="Free"/>')).toEqual([1500, 0]);
    expect(await placed('<ComponentSet name="Tag"><Component variant="Tone=Dark"/></ComponentSet>')).toEqual([1500, 0]);
  });
});

describe("apply: sections", () => {
  it("sizes a new section as Figma lets it, without constraints", async () => {
    root = page();
    fake = installFigma(root, LIBRARY, { strict: true });

    const result = await apply('<Section name="Area" width="400px" height="300px"/>');
    const [made] = fake.writes.created;

    expect(result.errors).toEqual([]);
    expect([made?.type, made?.width, made?.height]).toEqual(["SECTION", 400, 300]);
  });
});

describe("apply: creating", () => {
  it("creates a frame with a text in auto layout under the parent, the font loaded before the characters", async () => {
    const result = await apply(
      '<Frame name="Badge" display="flex" padding="8px 12px" gap="4px" background="#191A23"><Text color="#FFF" font="500 14px/20px \'Inter\'">New</Text></Frame>',
      { parent: "3:1" },
    );
    const [frame, text] = fake.writes.created;

    expect(result.errors).toEqual([]);
    expect(result.created.map(({ tag, line }) => [tag, line])).toEqual([
      ["Frame", 1],
      ["Text", 1],
    ]);
    expect(frame).toMatchObject({
      name: "Badge",
      layoutMode: "HORIZONTAL",
      paddingTop: 8,
      paddingRight: 12,
      itemSpacing: 4,
      layoutSizingHorizontal: "HUG",
      layoutSizingVertical: "HUG",
      fills: [
        expect.objectContaining({
          type: "SOLID",
          color: DARK,
        }),
      ],
    });
    expect(frame?.parent?.id).toBe("3:1");
    expect(text?.parent).toBe(frame);
    expect(text).toMatchObject({
      characters: "New",
      fontName: {
        family: "Inter",
        style: "Medium",
      },
      fontSize: 14,
      lineHeight: {
        unit: "PIXELS",
        value: 20,
      },
    });
    expect(fake.writes.undo).toBe(1);
  });

  it("puts a create after the element before it in the XML, alone at the end", async () => {
    await apply('<Frame id="1:1"><Text id="1:2"/><Frame name="Between"/><Frame id="1:3"/></Frame>');
    await apply('<Frame id="1:1"><Frame name="Last"/></Frame>');

    expect(byId("1:1")?.children?.map(({ name }) => name)).toEqual(["Title", "Between", "Side", "Last"]);
  });
});

describe("apply: changing", () => {
  it("changes the attributes given and leaves the rest, one undo step for the call", async () => {
    const result = await apply('<Frame id="1:1" opacity="0.5"/>\n<Frame id="3:1" name="Free board"/>');

    expect(result).toMatchObject({
      changed: ["1:1", "3:1"],
      errors: [],
    });
    expect(byId("1:1")).toMatchObject({
      opacity: 0.5,
      fillStyleId: "S:dark",
    });
    expect(byId("3:1")?.name).toBe("Free board");
    expect(fake.writes.undo).toBe(1);
  });

  it("changes a text inside an instance by its id, as an override", async () => {
    const result = await apply('<Text id="I2:1;3:4">Our services</Text>');

    expect(result.errors).toEqual([]);
    expect(byId("I2:1;3:4")?.characters).toBe("Our services");
    expect(fake.writes.loaded.has("Space Grotesk Medium")).toBe(true);
    expect(byId("2:1")?.type).toBe("INSTANCE");
  });

  it("fills the parent's direction, pins to the right edge, turns about the centre", async () => {
    await apply('<Frame id="1:3" flex="1"/>');
    await apply('<Frame id="3:2" position="absolute" right="20px" top="10px" width="100px"/>');

    expect(byId("1:3")?.layoutSizingHorizontal).toBe("FILL");
    expect(byId("3:2")?.relativeTransform).toEqual([
      [1, 0, 280],
      [0, 1, 10],
    ]);
    expect(byId("3:2")?.constraints).toEqual({
      horizontal: "MAX",
      vertical: "MIN",
    });

    await apply('<Frame id="3:2" transform="rotate(-90deg)"/>');

    const [[a, b, x], [c, d, y]] = (byId("3:2") as FakeNode).relativeTransform as [number[], number[]];

    // Turned a quarter about its centre (330, 30): the 100 x 40 box now spans 20 across and 50 down from there.
    expect([a, b, c, d].map((value) => Math.round(value ?? 0))).toEqual([0, 1, -1, 0]);
    expect([Math.round(x ?? 0), Math.round(y ?? 0)]).toEqual([310, 80]);
  });
});

describe("apply: colours in a Display P3 file", () => {
  it("writes a P3 colour as it is and an sRGB one converted to P3", async () => {
    Object.assign(figma.root, { documentColorProfile: "DISPLAY_P3" });

    await apply('<Frame id="3:1" background="color(display-p3 1 0 0)"/>');

    const fillsOf = () => (byId("3:1")?.fills ?? []) as { color: { r: number; g: number; b: number } }[];

    expect(fillsOf()[0]?.color).toEqual({
      r: 1,
      g: 0,
      b: 0,
    });

    await apply('<Frame id="3:1" background="#FF0000"/>');

    const [paint] = fillsOf();

    expect(paint?.color.r).toBeCloseTo(0.9175, 3);
    expect(paint?.color.g).toBeCloseTo(0.2003, 3);
    Object.assign(figma.root, { documentColorProfile: "SRGB" });
  });

  it("writes an underline's colour in the file's space too", async () => {
    Object.assign(figma.root, { documentColorProfile: "DISPLAY_P3" });

    await apply('<Text id="1:2" text-decoration="underline solid #FF0000"/>');

    const decoration = byId("1:2")?.textDecorationColor as { value: { color: { r: number } } } | undefined;

    expect(decoration?.value.color.r).toBeCloseTo(0.9175, 3);
    Object.assign(figma.root, { documentColorProfile: "SRGB" });
  });
});

describe("apply: tokens, fonts and errors", () => {
  it("binds var() to the style the page uses, and names close tokens for one that matches nothing", async () => {
    await apply('<Frame id="3:1" background="var(--Dark)"/>');

    expect(byId("3:1")?.fillStyleId).toBe("S:dark");

    const { errors } = await apply('<Frame id="3:1" background="var(--Darkk)"/>');

    expect(errors).toEqual([
      expect.objectContaining({
        line: 1,
        attribute: "background",
        message: expect.stringMatching(/--Darkk/),
        hint: expect.stringMatching(/--Dark\b/),
      }),
    ]);
  });

  it("names the styles a family has when the font asked for is not among them", async () => {
    const { errors } = await apply('<Text id="1:2" font="300 14px/20px \'Inter\'">Hi</Text>');

    expect(errors).toEqual([
      expect.objectContaining({
        attribute: "font",
        message: expect.stringMatching(/Regular, Medium, Bold/),
      }),
    ]);
  });

  it("applies the good changes when one is bad, each error on its line", async () => {
    const result = await apply(
      '<Frame id="1:1" opacity="0.5"/>\n<Frame id="9:9" opacity="0.5"/>\n<Frame id="3:1" flex="1"/>\n<Frame id="3:2" name="Kept"/>',
    );

    expect(result.changed).toEqual(["1:1", "3:2"]);
    expect(result.errors.map(({ line, attribute }) => [line, attribute])).toEqual([
      [2, undefined],
      [3, "flex"],
    ]);
    expect(byId("3:2")?.name).toBe("Kept");
    expect(fake.writes.undo).toBe(1);
  });
});

describe("entries", () => {
  it("gives each layer asked for with its descendants and its parent, those inside another one within it", async () => {
    const result = (await plugin.run("entries", { ids: ["1:1", "1:2", "3:2", "9:9"] })) as {
      roots: { node: { id: string; children?: { id: string }[] }; parent: { id: string; x: number } | null }[];
      missing: string[];
    };

    expect(result.roots.map(({ node, parent }) => [node.id, parent?.id ?? null])).toEqual([
      ["1:1", null],
      ["3:2", "3:1"],
    ]);
    expect(result.roots[0]?.node.children?.map(({ id }) => id)).toEqual(["1:2", "1:3"]);
    expect(result.roots[1]?.parent?.x).toBe(0);
    expect(result.missing).toEqual(["9:9"]);
  });
});

describe("delete", () => {
  it("deletes layers, refuses one inside an instance and a missing one, one undo step, never without Allow edits", async () => {
    const result = (await plugin.run("delete", { nodes: ["3:2", "I2:1;3:4", "9:9"] })) as {
      deleted: string[];
      errors: { id: string; message: string }[];
    };

    expect(result.deleted).toEqual(["3:2"]);
    expect(byId("3:1")?.children).toEqual([]);
    expect(result.errors.map(({ id }) => id)).toEqual(["I2:1;3:4", "9:9"]);
    expect(result.errors[0]?.message).toMatch(/instance/);
    expect(fake.writes.undo).toBe(1);

    plugin.services.edits.allow(false);

    await expect(plugin.run("delete", { nodes: ["1:2"] })).rejects.toMatchObject({ code: "EDITS_DISABLED" });
  });
});

describe("apply: review fixes", () => {
  const calls = (node: string, method?: string) =>
    fake.writes.calls.filter((call) => call.node === node && (method === undefined || call.method === method));

  it("reads a hidden layer asked for whole, with its layers", async () => {
    const result = (await plugin.run("entries", { ids: ["4:1"] })) as {
      roots: { node: { layoutMode?: string; children?: { id: string }[] } }[];
    };

    expect(result.roots[0]?.node.layoutMode).toBe("VERTICAL");
    expect(result.roots[0]?.node.children?.map(({ id }) => id)).toEqual(["4:2"]);
  });

  it("gives the whole text its own look again when its runs change, the characters the same", async () => {
    await apply('<Text id="1:4">Hello world</Text>');

    expect(calls("1:4", "setRangeFills")).toEqual([
      expect.objectContaining({
        args: [0, 11, [expect.objectContaining({ color: DARK })]],
      }),
    ]);
  });

  it("loads a text's fonts before sizing it", async () => {
    const { errors } = await apply('<Text id="1:2" width="200px"/>');

    expect(errors).toEqual([]);
    expect(byId("1:2")).toMatchObject({
      width: 200,
      textAutoResize: "HEIGHT",
    });
  });

  it("keeps the font a text has for its weight, else takes the nearest, never a far one", async () => {
    const kept = await apply('<Text id="1:6" font="590 20px/24px \'SF Pro\'">Hi</Text>');
    const made = await apply(
      "<Text font=\"590 16px/normal 'SF Pro'\">New</Text>\n<Text font=\"400 16px/normal 'Inter'\">New</Text>",
      {
        parent: "3:1",
      },
    );

    expect([kept.errors, made.errors]).toEqual([[], []]);
    expect(byId("1:6")?.fontName).toEqual({
      family: "SF Pro",
      style: "Semibold",
    });
    expect(fake.writes.created.map(({ fontName }) => (fontName as { style: string }).style)).toEqual([
      "Semibold",
      "Regular",
    ]);
  });

  it("sets a text bound to a component property through the instance's property", async () => {
    const result = await apply('<Text id="I2:5;3:6">New label</Text>');

    expect(result.errors).toEqual([]);
    expect(calls("2:5", "setProperties")).toEqual([
      expect.objectContaining({
        args: [{ "Label#1:0": "New label" }],
      }),
    ]);
    expect(byId("I2:5;3:6")?.characters).toBe("New label");
  });

  it("keeps a styled text's style when its characters change, writing no raw look over it", async () => {
    await apply('<Text id="I2:1;3:4">Our services</Text>');

    expect(byId("I2:1;3:4")?.textStyleId).toBe("S:h3");
    expect(calls("I2:1;3:4").map(({ method }) => method)).toEqual(["characters"]);
  });

  it("keeps the other axis hugging when one size is set", async () => {
    await apply('<Frame id="1:7" width="400px"/>');

    expect(byId("1:7")).toMatchObject({
      width: 400,
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "HUG",
    });
  });

  it("stands a line upright when it is given a height and its left border", async () => {
    const { created, errors } = await apply('<Line height="120px" border-left="1px solid #191A23"/>', {
      parent: "3:1",
    });
    const line = byId(created[0]?.id ?? "");
    const [[a, b], [c, d]] = (line as FakeNode).relativeTransform as [number[], number[]];

    expect(errors).toEqual([]);
    expect(line?.width).toBe(120);
    expect([a, b, c, d].map((value) => Math.round(value ?? 0))).toEqual([0, -1, 1, 0]);
    expect(line?.strokeWeight).toBe(1);
  });
});

describe("upload", () => {
  it("puts a file's chunks together, and gives its bytes only once all of them came", async () => {
    const bytes = Uint8Array.from({ length: 10 }, (_, index) => index);
    const chunk = (from: number, to: number) => btoa(String.fromCharCode(...bytes.subarray(from, to)));

    await plugin.run("upload", {
      stream: "s-1",
      offset: 0,
      chunk: chunk(0, 6),
      total: 10,
    });

    expect(plugin.services.uploads.bytes("s-1")).toBeUndefined();

    await plugin.run("upload", {
      stream: "s-1",
      offset: 6,
      chunk: chunk(6, 10),
      total: 10,
    });

    expect([...(plugin.services.uploads.bytes("s-1") ?? [])]).toEqual([...bytes]);
  });
});
