import { describe, expect, it } from "vitest";
import { NoteStep } from "@/plugin/operations/apply/writers/note-step.ts";

const design = { id: "cat1", label: "Design" };

type Given = { category: string | null; label: string; pins?: string[] };

async function written(
  annotations: object[],
  notes: Given[],
  type = "FRAME",
) {
  const layer = { annotations, type };

  await new NoteStep({ categories: async () => [design] } as never).write(layer as never, { notes });

  return layer.annotations;
}

describe("NoteStep.write", () => {
  it("files `Category: text` under the file's category, whatever its case, and keeps an unknown one as text", async () => {
    expect(await written([], [{ category: "design", label: "Gap is 8" }])).toEqual([
      { categoryId: "cat1", label: "Gap is 8" },
    ]);
    expect(await written([], [{ category: null, label: "Other: Gap" }])).toEqual([{ label: "Other: Gap" }]);
  });

  it("keeps a note the layer has, sent back as design_read writes it, with its pins", async () => {
    const had = { label: "Gap is 8", categoryId: "cat1", properties: [{ type: "itemSpacing" }] };

    expect(await written([had], [{ category: "Design", label: "Gap is 8", pins: ["gap"] }])).toEqual([had]);
  });

  it("keeps the same words' formatting under another category or other pins, and pins what the note names", async () => {
    const had = { labelMarkdown: "**Gap**", label: "Gap", categoryId: "cat1", properties: [{ type: "width" }] };

    expect(await written([had], [{ category: null, label: "Gap" }])).toEqual([{ labelMarkdown: "**Gap**" }]);
    expect(await written([had], [{ category: "Design", label: "Gap", pins: ["height", "grid-row"] }])).toEqual([
      {
        labelMarkdown: "**Gap**",
        categoryId: "cat1",
        properties: [{ type: "height" }, { type: "gridRowAnchorIndex" }, { type: "gridRowSpan" }],
      },
    ]);
  });

  // NEW-090: a note of pins alone is design_read's bracket, so it is kept, changed or removed like any other.
  it("writes, keeps and removes a note of pins alone, a text's color as its fills", async () => {
    const pinsOnly = { properties: [{ type: "fills" }] };

    expect(await written([], [{ category: null, label: "", pins: ["background"] }])).toEqual([pinsOnly]);
    expect(await written([pinsOnly], [{ category: null, label: "", pins: ["color"] }], "TEXT")).toEqual([pinsOnly]);
    expect(await written([pinsOnly], [{ category: null, label: "Kept" }])).toEqual([{ label: "Kept" }]);
  });

  it("B-017: a bar between new words is one note's text, before a note the layer has it separates", async () => {
    expect(
      await written(
        [],
        [
          { category: null, label: "Tabs: Days" },
          { category: null, label: "Weeks" },
        ],
      ),
    ).toEqual([{ label: "Tabs: Days | Weeks" }]);

    const had = { label: "Old" };

    expect(
      await written(
        [had],
        [
          { category: null, label: "New" },
          { category: null, label: "Old" },
        ],
      ),
    ).toEqual([{ label: "New" }, had]);
  });

  it("FX-045: a note with both texts is written with its Markdown alone, and one with neither text nor pins stays last", async () => {
    const both = { label: "x", labelMarkdown: "**x**" };
    const untold = { label: "" };

    expect(await written([both, untold], [{ category: null, label: "x" }])).toEqual([{ labelMarkdown: "**x**" }, {}]);
  });

  it("an empty list removes the notes that have text", async () => {
    expect(await written([{ label: "x" }], [])).toEqual([]);
  });
});

// NEW-090 live: Figma refuses a pin the layer cannot hold ("Invalid property fills for a FRAME node" on a frame without
// fills, itemSpacing without auto layout), so design_apply refuses it first, alike on dry and real runs (m:f66aed65):
// a dry run's layer for a new one is a stand-in with no state, a real run's a made layer, and both must answer alike.
describe("NoteStep.check", () => {
  const paint = { type: "color" };
  const stroke = { paints: [paint], align: "INSIDE", dash: false };

  function checkOf(
    words: string[],
    layer: object,
    props: object = {},
    change: object = { kind: "update", props },
  ): () => void {
    const notes = [{ category: null, label: "Note", pins: words }];

    return () =>
      new NoteStep({} as never).check(
        { ...props, notes } as never,
        layer as never,
        { tag: "Frame", props, ...change } as never,
      );
  }

  const standIn = { type: "FRAME" };
  const made = { type: "FRAME", fills: [], strokes: [], effects: [], layoutMode: "NONE" };

  it.each([
    [
      "a frame without fills",
      "background",
      { type: "FRAME", fills: [] },
      "A note pins background, but this frame has no fill.",
    ],
    [
      "a frame without strokes",
      "border",
      { type: "FRAME", strokes: [] },
      "A note pins border, but this frame has no stroke.",
    ],
    [
      "a frame without effects",
      "box-shadow",
      { type: "FRAME", effects: [] },
      "A note pins box-shadow, but this frame has no effect.",
    ],
    [
      "a frame without auto layout",
      "gap",
      { type: "FRAME", layoutMode: "NONE" },
      "A note pins gap, but this frame has no auto layout.",
    ],
    [
      "a frame with no grid",
      "row-gap",
      { type: "FRAME", layoutMode: "VERTICAL" },
      "A note pins row-gap, but this frame has no grid layout.",
    ],
    ["a frame, no text", "font-size", { type: "FRAME" }, "A note pins font-size, but this frame holds no text."],
    ["a frame, no instance", "component", { type: "FRAME" }, "A note pins component, but this frame is no instance."],
  ])("refuses a pin %s, with a hint", (_name, word, layer, message) => {
    const run = checkOf([word], layer);

    expect(run).toThrow(message);
    expect(run).toThrow(expect.objectContaining({ hint: expect.stringContaining("leave the word out") }));
  });

  it("holds a pin the layer has, and one a size, an opacity or a radius makes always", () => {
    const held = { type: "FRAME", fills: [{}], strokes: [{}], effects: [{}], layoutMode: "HORIZONTAL" };

    expect(
      checkOf(["background", "border", "border-width", "box-shadow", "gap", "padding", "flex-direction"], held),
    ).not.toThrow();
    expect(checkOf(["width", "height", "opacity", "border-radius", "min-width"], { type: "FRAME" })).not.toThrow();
    expect(checkOf(["font-size", "color"], { type: "TEXT", fills: [{}] })).not.toThrow();
    expect(checkOf(["component"], { type: "INSTANCE" })).not.toThrow();
  });

  it("counts what the same call gives (the note is written after fills, strokes, effects and layout)", () => {
    const layer = { type: "FRAME", fills: [], strokes: [], effects: [], layoutMode: "NONE" };

    expect(checkOf(["background"], layer, { fills: [paint] })).not.toThrow();
    expect(checkOf(["border-width"], layer, { strokes: stroke })).not.toThrow();
    expect(checkOf(["box-shadow"], layer, { effects: [{}] })).not.toThrow();
    expect(checkOf(["gap"], layer, { layoutMode: "VERTICAL" })).not.toThrow();
    expect(checkOf(["row-gap"], layer, { layoutMode: "GRID" })).not.toThrow();
    // ...and what it takes away.
    expect(checkOf(["background"], { type: "FRAME", fills: [{}] }, { fills: [] })).toThrow("has no fill");
    expect(checkOf(["gap"], { type: "FRAME", layoutMode: "VERTICAL" }, { layoutMode: "NONE" })).toThrow(
      "no auto layout",
    );
  });

  it.each([standIn, made])("answers a new layer alike whether it is a stand-in or made (%j)", (layer) => {
    const create = { kind: "create" };

    expect(checkOf(["background"], layer, {}, create)).toThrow("has no fill");
    expect(checkOf(["gap"], layer, {}, create)).toThrow("no auto layout");
    expect(checkOf(["background"], layer, { fills: [paint] }, create)).not.toThrow();
    expect(checkOf(["gap"], layer, { layoutMode: "HORIZONTAL" }, create)).not.toThrow();
    expect(checkOf(["width"], layer, {}, create)).not.toThrow();
  });

  it("holds a new text's colour (Figma's own fill), an image's fill and what a copy or a new instance brings", () => {
    const create = { kind: "create" };

    expect(checkOf(["color"], { type: "TEXT" }, {}, create)).not.toThrow();
    expect(checkOf(["color"], { type: "TEXT", fills: [{}] }, {}, create)).not.toThrow();
    expect(checkOf(["background"], standIn, { asset: { kind: "image", src: "a.png" } }, create)).not.toThrow();
    expect(checkOf(["background"], standIn, {}, { kind: "create", copyOf: "1:2" })).not.toThrow();
    expect(checkOf(["background", "gap"], { type: "INSTANCE" }, {}, create)).not.toThrow();
  });

  it("refuses the colour of an existing text with no fills, and tells a note of no pins nothing", () => {
    expect(checkOf(["color"], { type: "TEXT", fills: [] })).toThrow("A note pins color, but this text has no fill.");
    expect(
      new NoteStep({} as never).check(
        { notes: [{ category: null, label: "Gap" }] },
        standIn as never,
        { props: {} } as never,
      ),
    ).toBeUndefined();
  });
});
