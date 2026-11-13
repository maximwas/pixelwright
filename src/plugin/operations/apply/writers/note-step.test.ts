import { describe, expect, it } from "vitest";
import { NoteStep } from "@/plugin/operations/apply/writers/note-step.ts";

const design = { id: "cat1", label: "Design" };

async function written(annotations: object[], notes: { category: string | null; label: string }[]) {
  const layer = { annotations };

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

    expect(await written([had], [{ category: "Design", label: "Gap is 8" }])).toEqual([had]);
  });

  it("keeps the same words' formatting under another category, and leaves the old category", async () => {
    const had = { label: "Gap", categoryId: "cat1", properties: [{ type: "width" }] };

    expect(await written([had], [{ category: null, label: "Gap" }])).toEqual([
      { label: "Gap", properties: [{ type: "width" }] },
    ]);
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

  it("FX-045: a note with both texts is written with its Markdown alone, and a note without text stays last", async () => {
    const both = { label: "x", labelMarkdown: "**x**" };
    const untold = { properties: [{ type: "fills" }] };

    expect(await written([both, untold], [{ category: null, label: "x" }])).toEqual([
      { labelMarkdown: "**x**" },
      untold,
    ]);
  });

  it("an empty list removes the notes that have text", async () => {
    expect(await written([{ label: "x" }], [])).toEqual([]);
  });
});
