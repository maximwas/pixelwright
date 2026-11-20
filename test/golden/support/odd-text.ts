import * as zod from "zod/mini";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

/** A run of a text: its characters, and what it sets over Inter Regular 16 without fills. */
type Run = readonly [characters: string, look?: Record<string, unknown>];

const BOLD = { fontName: { family: "Inter", style: "Bold" }, fontWeight: 700 };

/** A text layer made of these runs, in order. */
function textLayer(
  id: string,
  name: string,
  runs: readonly Run[],
): Record<string, unknown> {
  let start = 0;
  const segments = runs.map(([characters, look]) => {
    const segment = {
      characters,
      start,
      end: start + characters.length,
      fontName: { family: "Inter", style: "Regular" },
      fontSize: 16,
      fontWeight: 400,
      textDecoration: "NONE",
      textCase: "ORIGINAL",
      lineHeight: { unit: "AUTO" },
      letterSpacing: { unit: "PIXELS", value: 0 },
      fills: [],
      fillStyleId: "",
      textStyleId: "",
      ...look,
    };

    start += characters.length;

    return segment;
  });

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
      characters: runs.map(([characters]) => characters).join(""),
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments,
    },
  };
}

/**
 * 0.7.0's odd-text snapshot as a read model (C-198): what XML has to escape or keep whole: quotes, ampersands, angle
 * brackets, line breaks and U+2028 in a name and a note; texts of no-break or plain spaces only, a run of one no-break
 * space, and runs that read alike side by side.
 */
export function oddTextModel(): ReadModel {
  const children = [
    textLayer("1:2", "No-break space", [["\u00a0"]]),
    textLayer("1:3", "Escapes", [['Line\u2028break\ttab & <tag> "quoted" \u2003']]),
    textLayer("1:4", "Bold gap", [["a"], ["\u00a0", BOLD], ["b"]]),
    textLayer("1:5", "Spaces", [["  "]]),
    textLayer("1:6", "Alike runs", [["x"], ["  "], ["y\u00a0"]]),
  ];

  return zod.parse(ReadModelSchema, {
    root: {
      id: "1:1",
      name: 'Say "hi" & <go>\nnow\u2028then',
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
  });
}
