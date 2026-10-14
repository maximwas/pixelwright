import type { Snapshot } from "../../src/index.ts";
import { BOLD, textLayer } from "./layers.ts";

/**
 * What XML has to escape or keep whole: quotes, ampersands, angle brackets, line breaks and U+2028 in a name and a
 * note; texts of no-break or plain spaces only, a run of one no-break space, and runs that read alike side by side.
 */
export function oddTextSnapshot(): Snapshot {
  const children = [
    textLayer("1:2", "No-break space", [["\u00a0"]]),
    textLayer("1:3", "Escapes", [['Line\u2028break\ttab & <tag> "quoted" \u2003']]),
    textLayer("1:4", "Bold gap", [["a"], ["\u00a0", BOLD], ["b"]]),
    textLayer("1:5", "Spaces", [["  "]]),
    textLayer("1:6", "Alike runs", [["x"], ["  "], ["y\u00a0"]]),
  ];

  return {
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
  };
}
