import { describe, expect, it } from "vitest";
import { NearbyNotes } from "@/core/inspect/nearby.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const SCREEN = { x: 0, y: 0, width: 1440, height: 900 };
const nearby = new NearbyNotes(new NumberFormat());
const note = (
  id: string,
  name: string,
  box: typeof SCREEN,
  text: string,
) => ({ id, name, box, text });

describe("notes near a screen (T-058, K-062)", () => {
  it("keeps the notes within the distance, nearest first, with the side each one is on", () => {
    expect(
      nearby.notes(
        SCREEN,
        [
          note("1:1", "Hover", { x: 1540, y: 100, width: 200, height: 40 }, "Cards lift on hover."),
          note("1:2", "Old idea", { x: 3000, y: 0, width: 100, height: 20 }, "Try a carousel?"),
          note("1:3", "Copy", { x: 200, y: -80, width: 300, height: 30 }, "Copy is final."),
          note("1:4", "Redline", { x: 600, y: 400, width: 200, height: 20 }, "24 between cards"),
          note("1:5", "Corner", { x: 1500, y: 950, width: 100, height: 30 }, "Footer stays dark."),
        ],
        { distance: 400, max: 20 },
      ),
    ).toEqual({
      notes: [
        { id: "1:4", name: "Redline", text: "24 between cards", side: "over", distance: 0 },
        { id: "1:3", name: "Copy", text: "Copy is final.", side: "above", distance: 50 },
        { id: "1:5", name: "Corner", text: "Footer stays dark.", side: "right", distance: 78.1 },
        { id: "1:1", name: "Hover", text: "Cards lift on hover.", side: "right", distance: 100 },
      ],
      more: 0,
    });
  });

  it("puts a note touching the screen's edge on that side, not over it", () => {
    const edge = note("3:1", "Edge", { x: 1440, y: 100, width: 200, height: 40 }, "Starts where the screen ends.");

    expect(nearby.notes(SCREEN, [edge], { distance: 400, max: 20 }).notes).toMatchObject([
      { side: "right", distance: 0 },
    ]);
  });

  it("lists at most max, and says how many more there are", () => {
    const candidates = [10, 20, 30].map((gap, index) =>
      note(`2:${index}`, "Note", { x: 1440 + gap, y: 0, width: 10, height: 10 }, `Note ${index}`),
    );

    expect(nearby.notes(SCREEN, candidates, { distance: 400, max: 2 })).toMatchObject({
      notes: [{ id: "2:0" }, { id: "2:1" }],
      more: 1,
    });
  });
});
