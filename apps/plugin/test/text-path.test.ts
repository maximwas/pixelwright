import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { PluginClient } from "../../server/src/plugin/plugin-client.ts";
import { textNode } from "./helpers/apply-document.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** The label of a round menu's sector, set along an arc (the Kolo file's "Підпис по дузі"). */
const ARC = "M 0 50 C 55.228 -16.667 144.772 -16.667 200 50";

let page: FakeNode;

const byId = (id: string): FakeNode => {
  const find = (at: FakeNode): FakeNode | undefined =>
    at.id === id ? at : (at.children ?? []).map(find).find((found) => found !== undefined);

  return find(page) as FakeNode;
};

beforeEach(() => {
  const { textAutoResize: _none, ...text } = textNode("1:2", "Об'єднати");

  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Menu",
        width: 400,
        height: 400,
        children: [
          {
            ...text,
            type: "TEXT_PATH",
            name: "Підпис по дузі",
            absoluteBoundingBox: {
              x: 100,
              y: 20,
              width: 200,
              height: 50,
            },
            vectorPaths: [
              {
                windingRule: "NONE",
                data: ARC,
              },
            ],
            textPathStartData: {
              segment: 0,
              position: 0.5,
            },
          },
        ],
      },
    ],
  });
  installFigma(page, {
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
      {
        family: "Inter",
        style: "Medium",
      },
    ],
  });
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const client = () => new PluginClient(pluginBridge(plugin));

const apply = (xml: string, dryRun = false) =>
  applyDesign(client(), {
    xml,
    dryRun,
    parent: "1:1",
  });

const read = async (id: string) => {
  const result = await readDesign(client(), {
    node: id,
    screenshot: false,
    maxChars: 80_000,
    code: false,
  });

  return (result.content[0] as { text: string }).text;
};

describe("design_read: text on a path", () => {
  it("reads its text with a text's CSS, its path in its own box and where the text starts, not an icon", async () => {
    const xml = await read("1:1");

    expect(xml).toContain(
      '<TextPath id="1:2" name="Підпис по дузі" d="M 0 50 C 55.23 -16.67 144.77 -16.67 200 50" start="0 0.5" position="absolute" left="100px" top="20px"',
    );
    expect(xml).toContain('font="400 16px/normal \'Inter\'" color="#000">Об\'єднати</TextPath>');
    expect(xml).not.toContain("<Icon");
    expect(xml).not.toContain("assets/");
  });
});

describe("design_apply: an existing text on a path", () => {
  it("writes nothing when its read is sent back", async () => {
    await expect(apply(await read("1:1"))).resolves.toMatchObject({
      changed: [],
      created: [],
      errors: [],
    });
  });

  it("changes its characters and keeps its look, with no new layer", async () => {
    await expect(apply('<TextPath id="1:2">Розділити</TextPath>')).resolves.toMatchObject({
      changed: ["1:2"],
      created: [],
      errors: [],
    });

    expect(byId("1:2")).toMatchObject({
      type: "TEXT_PATH",
      characters: "Розділити",
      fontName: {
        family: "Inter",
        style: "Regular",
      },
      fontSize: 16,
    });
    expect(byId("1:1").children).toHaveLength(1);
  });

  it("makes no Text in it for a <Text> given inside: its characters are its own, and the error says so", async () => {
    const { errors, created } = await apply('<TextPath id="1:2"><Text>Розділити</Text></TextPath>');

    expect(created).toEqual([]);
    expect(errors).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("<Text> inside a TextPath"),
        hint: expect.stringContaining('<TextPath id="…">text</TextPath>'),
      }),
    ]);
    expect(byId("1:1").children).toHaveLength(1);
  });

  it("takes a text's CSS: a font and a colour", async () => {
    await expect(apply('<TextPath id="1:2" font="500 20px Inter" color="#FF0000"/>')).resolves.toMatchObject({
      errors: [],
    });

    // What the layer holds: the fake gives no weight of its own to a font it is given, so it is not read back.
    expect(byId("1:2")).toMatchObject({
      characters: "Об'єднати",
      fontName: {
        family: "Inter",
        style: "Medium",
      },
      fontSize: 20,
      fills: [
        expect.objectContaining({
          type: "SOLID",
          color: {
            r: 1,
            g: 0,
            b: 0,
          },
        }),
      ],
    });
    expect(await read("1:2")).toContain('color="#F00">Об\'єднати</TextPath>');
  });

  it("refuses a line height in font, which a text on a path has not, in a dry run too, and writes no font", async () => {
    for (const dryRun of [true, false]) {
      const result = await apply('<TextPath id="1:2" font="500 16px/24px \'Inter\'"/>', dryRun);

      expect(result).toMatchObject({
        changed: [],
        errors: [
          expect.objectContaining({
            id: "1:2",
            attribute: "font",
            message: "A text path has no line height.",
            hint: "Give its font without one: font=\"500 16px 'Inter'\".",
          }),
        ],
      });
    }

    expect(byId("1:2").fontName).toEqual({
      family: "Inter",
      style: "Regular",
    });
  });

  it("names the layer's type as its tag when the tag sent is another", async () => {
    const refusal = async (xml: string) => (await apply(xml)).errors.map(({ message }) => message);

    expect(await refusal('<Icon id="1:2" opacity="0.5"/>')).toEqual(["1:2 is a TextPath, not an Icon."]);
    expect(await refusal('<Text id="1:2">Так</Text>')).toEqual(["1:2 is a TextPath, not a Text."]);
    expect(await refusal('<TextPath id="1:1">Ні</TextPath>')).toEqual(["1:1 is a frame, not a TextPath."]);
  });

  it("refuses an underline, which Figma has for a text and not a text on a path, in a dry run too", async () => {
    for (const dryRun of [true, false]) {
      const { errors } = await apply('<TextPath id="1:2" text-decoration="underline"/>', dryRun);

      expect(errors).toEqual([
        expect.objectContaining({
          id: "1:2",
          attribute: "text-decoration",
          message: "A text path has no underline or strike-through.",
        }),
      ]);
    }
  });

  it("moves where its text starts", async () => {
    await expect(apply('<TextPath id="1:2" start="1 0.25"/>')).resolves.toMatchObject({
      changed: ["1:2"],
      errors: [],
    });

    expect(byId("1:2").textPathStartData).toEqual({
      segment: 1,
      position: 0.25,
    });
  });

  it("refuses another path, which Figma cannot give an existing one, in a dry run too", async () => {
    for (const dryRun of [true, false]) {
      const { errors } = await apply('<TextPath id="1:2" d="M 0 0 L 10 10">Розділити</TextPath>', dryRun);

      expect(errors).toEqual([
        expect.objectContaining({
          id: "1:2",
          attribute: "d",
          hint: "Figma cannot change a text path's path: delete it and make it again.",
        }),
      ]);
    }

    expect(byId("1:2").vectorPaths).toEqual([
      {
        windingRule: "NONE",
        data: ARC,
      },
    ]);
    expect(byId("1:2").characters).toBe("Розділити");
  });
});

describe("design_apply: a new text on a path", () => {
  it("is made along the path d gives, from where start says, with its text and look", async () => {
    const result = await apply(
      '<TextPath name="Label" d="M 0 0 L 100 0" start="0 0.5" font="500 14px Inter" color="#FF0000">Додати</TextPath>',
    );

    expect(result).toMatchObject({ errors: [] });
    expect(result.created).toHaveLength(1);

    const made = byId("1:1").children?.at(-1) as FakeNode;

    expect(made).toMatchObject({
      type: "TEXT_PATH",
      name: "Label",
      characters: "Додати",
      vectorPaths: [{ data: "M 0 0 L 100 0" }],
      textPathStartData: {
        segment: 0,
        position: 0.5,
      },
      fontName: {
        family: "Inter",
        style: "Medium",
      },
      fontSize: 14,
      fills: [
        expect.objectContaining({
          color: {
            r: 1,
            g: 0,
            b: 0,
          },
        }),
      ],
    });
  });

  it("takes any SVG path: relative commands and arcs become Figma's absolute lines and curves", async () => {
    await expect(apply('<TextPath d="m 0 0 h 100 a 50 50 0 0 1 50 50">Go</TextPath>')).resolves.toMatchObject({
      errors: [],
    });

    const made = byId("1:1").children?.at(-1) as FakeNode;
    const data = (made.vectorPaths as { data: string }[])[0]?.data;

    expect(data).toMatch(/^M 0 0 C [-\d. ]+ C [-\d. ]+$/);
    expect(data).toMatch(/ 150 50$/);
  });

  it("is made along an arc of a circle in its parent, placed at the arc's box", async () => {
    // From the left of the circle over its top to its right: 0 is the top, as CSS turns.
    await expect(apply('<TextPath arc="200 200 100 -90 90">Меню</TextPath>')).resolves.toMatchObject({ errors: [] });

    const made = byId("1:1").children?.at(-1) as FakeNode;
    const data = (made.vectorPaths as { data: string }[])[0]?.data ?? "";

    expect(made.relativeTransform).toEqual([
      [1, 0, 100],
      [0, 1, 100],
    ]);
    expect(data.startsWith("M 0 100 C")).toBe(true);
    expect(data.endsWith(" 200 100")).toBe(true);
    expect(made.characters).toBe("Меню");
  });

  it("refuses one without a path, and an arc that is none", async () => {
    const { errors } = await apply('<TextPath>Ні</TextPath><TextPath arc="200 200 0 0 90">Ні</TextPath>');

    expect(errors).toEqual([
      expect.objectContaining({ message: expect.stringContaining("d or arc") }),
      expect.objectContaining({ attribute: "arc" }),
    ]);
    expect(byId("1:1").children).toHaveLength(1);
  });
});

/**
 * Figma anchors a text on a path's alignment at its start (live 2026-10-22): left begins there, center centres on it,
 * right ends there, and letters before the path's beginning are not drawn, so a centred text from "0 0" shows one
 * letter. A start is the segment and Figma's place on it, the curve's own parameter (live: not its share of length).
 */
describe("design_apply: text-align on a text on a path, with no start", () => {
  /** Where the text of the TextPath this XML makes starts, as the fake holds it. */
  const startOfNew = async (xml: string) => {
    await expect(apply(xml)).resolves.toMatchObject({ errors: [] });

    const made = byId("1:1").children?.at(-1) as FakeNode;

    return made.textPathStartData;
  };

  it.each([
    [
      "center",
      {
        segment: 1,
        position: 0,
      },
    ],
    [
      "right",
      {
        segment: 1,
        position: 1,
      },
    ],
    [
      "left",
      {
        segment: 0,
        position: 0,
      },
    ],
  ])("puts a new arc's start where text-align %s anchors: the middle, the end, the beginning", async (align, start) => {
    // Two quarter pieces, from the circle's left over its top to its right: its middle is where they meet.
    expect(await startOfNew(`<TextPath arc="200 200 100 -90 90" text-align="${align}">Середина</TextPath>`)).toEqual(
      start,
    );
  });

  it("puts a new arc's middle half way along its middle piece when the pieces are odd", async () => {
    expect(await startOfNew('<TextPath arc="200 200 100 -135 135" text-align="center">Меню</TextPath>')).toEqual({
      segment: 1,
      position: 0.5,
    });
  });

  it.each([
    [
      "center",
      {
        segment: 0,
        position: 0.5,
      },
    ],
    [
      "right",
      {
        segment: 0,
        position: 1,
      },
    ],
    [
      "left",
      {
        segment: 0,
        position: 0,
      },
    ],
  ])("puts a new d path's start where text-align %s anchors", async (align, start) => {
    expect(await startOfNew(`<TextPath d="${ARC}" text-align="${align}">Середина</TextPath>`)).toEqual(start);
  });

  it("finds the middle by length, then Figma's place on that segment by its curve", async () => {
    // Lines of 100 and 300 px: half the 400 px is a third along the second line.
    expect(await startOfNew('<TextPath d="M 0 0 L 100 0 L 100 300" text-align="center">Кут</TextPath>')).toEqual({
      segment: 1,
      position: 0.3333,
    });
    // x = 300 t³ along this curve: half its length (150 px) is at t = 0.7937, not 0.5.
    expect(await startOfNew('<TextPath d="M 0 0 C 0 0 0 0 300 0" text-align="center">Хвіст</TextPath>')).toEqual({
      segment: 0,
      position: 0.7937,
    });
  });

  it("keeps the start given with text-align", async () => {
    expect(
      await startOfNew('<TextPath arc="200 200 100 -90 90" text-align="center" start="0 0.25">Тут</TextPath>'),
    ).toEqual({
      segment: 0,
      position: 0.25,
    });
  });

  it("moves an existing one's start to the anchor its new text-align takes, unless start is given", async () => {
    await expect(apply('<TextPath id="1:2" text-align="right"/>')).resolves.toMatchObject({ errors: [] });
    expect(byId("1:2")).toMatchObject({
      textAlignHorizontal: "RIGHT",
      textPathStartData: {
        segment: 0,
        position: 1,
      },
    });

    await expect(apply('<TextPath id="1:2" text-align="center" start="0 0.25"/>')).resolves.toMatchObject({
      errors: [],
    });
    expect(byId("1:2")).toMatchObject({
      textAlignHorizontal: "CENTER",
      textPathStartData: {
        segment: 0,
        position: 0.25,
      },
    });
  });
});
