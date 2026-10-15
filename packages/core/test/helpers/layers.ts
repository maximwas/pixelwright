import type { SnapshotNode, TextSegment } from "../../src/index.ts";

/** A run of a text: its characters, and what it sets over Inter Regular 16 without fills. */
export type Run = readonly [characters: string, look?: Partial<TextSegment>];

export const BOLD: Partial<TextSegment> = {
  fontName: {
    family: "Inter",
    style: "Bold",
  },
  fontWeight: 700,
};

/** A text layer made of these runs, in order. */
export function textLayer(id: string, name: string, runs: readonly Run[]): SnapshotNode {
  const segments: TextSegment[] = [];
  let start = 0;

  for (const [characters, look] of runs) {
    segments.push({
      characters,
      start,
      end: start + characters.length,
      fontName: {
        family: "Inter",
        style: "Regular",
      },
      fontSize: 16,
      fontWeight: 400,
      textDecoration: "NONE",
      textCase: "ORIGINAL",
      lineHeight: { unit: "AUTO" },
      letterSpacing: {
        unit: "PIXELS",
        value: 0,
      },
      fills: [],
      fillStyleId: "",
      textStyleId: "",
      ...look,
    });
    start += characters.length;
  }

  return {
    id,
    name,
    type: "TEXT",
    visible: true,
    x: 0,
    y: 0,
    width: 200,
    height: 20,
    childCount: 0,
    text: {
      characters: segments.map(({ characters }) => characters).join(""),
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments,
    },
  };
}

/** A layer of these fields: a 100×100 frame at its parent's corner unless they say otherwise. */
export function layer(fields: Partial<SnapshotNode> & { id: string; name: string }): SnapshotNode {
  return {
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: fields.children?.length ?? 0,
    ...fields,
  };
}
