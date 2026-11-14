import { describe, expect, it } from "vitest";
import type { ApplyChange } from "@/core/apply/apply.types.ts";
import { SpreadNotes } from "@/server/tools/design-apply/spread-notes.ts";

const SHADOW = { type: "DROP_SHADOW", radius: 0, x: 0, y: 0, spread: 24 } as const;
const WHITE = { kind: "solid", color: { r: 1, g: 1, b: 1, a: 1 } } as const;

function change(
  tag: string,
  props: object,
  id: string | null = null,
): ApplyChange {
  return {
    line: 3,
    column: 5,
    kind: id === null ? "create" : "update",
    ref: id ?? "new:3",
    id,
    tag,
    parent: null,
    index: 0,
    props,
    sources: { effects: "box-shadow" },
  } as ApplyChange;
}

function notes(written: ApplyChange[], assessed: unknown[] = []) {
  return new SpreadNotes().notes({ written, assessed } as never);
}

describe("SpreadNotes", () => {
  it("notes a written spread on a Frame that does not clip its content, with what to set", () => {
    expect(notes([change("Frame", { effects: [SHADOW], fills: [WHITE] })])).toEqual([
      {
        line: 3,
        column: 5,
        attribute: "box-shadow",
        message: "Figma keeps this shadow's spread but draws none on this Frame.",
        hint: "Figma draws a spread only on a Rectangle or an Ellipse, or on a Frame, Component or Instance that clips its content (overflow: hidden) and has a visible fill (a background): set those, or leave the spread out.",
      },
    ]);
  });

  it("says nothing where Figma draws it: a Rectangle, a Frame that clips with a fill, an existing one that does", () => {
    const existing = {
      element: { ref: "1:2" },
      entry: { layer: { type: "FRAME", clipsContent: true, fills: [{ type: "SOLID", visible: true }] } },
    };

    expect(
      notes(
        [
          change("Rectangle", { effects: [SHADOW] }),
          change("Frame", { effects: [SHADOW], fills: [WHITE], clipsContent: true }),
          change("Frame", { effects: [SHADOW] }, "1:2"),
        ],
        [existing],
      ),
    ).toEqual([]);
  });
});
