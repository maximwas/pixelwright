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
