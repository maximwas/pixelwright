import type { Snapshot, SnapshotNode, TextSegment } from "../../src/index.ts";

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

/**
 * What XML has to escape or keep whole: quotes, ampersands, angle brackets, line breaks and U+2028 in a name and a
 * note; texts of no-break or plain spaces only, a run of one no-break space, and runs that read alike side by side.
 */
export function oddTextSnapshot(): Snapshot {
  const children = [
    textLayer("1:2", "No-break space", [[" "]]),
    textLayer("1:3", "Escapes", [['Line break\ttab & <tag> "quoted"  ']]),
    textLayer("1:4", "Bold gap", [["a"], [" ", BOLD], ["b"]]),
    textLayer("1:5", "Spaces", [["  "]]),
    textLayer("1:6", "Alike runs", [["x"], ["  "], ["y "]]),
  ];

  return {
    root: {
      id: "1:1",
      name: 'Say "hi" & <go>\nnow then',
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      childCount: children.length,
      layoutMode: "VERTICAL",
      annotations: [{ label: "Pipes | and \\ slashes\n& more" }],
      children,
    },
    styles: {},
    variables: {},
  };
}
