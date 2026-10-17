import type { FigmaProps } from "@pixelwright/core";
import { paintsOf } from "../../../figma/paints.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { decorate } from "./text-decoration.ts";
import type { SegmentField } from "./text-look.ts";
import type { TextRange } from "./text-range.ts";
import type { WriteScope } from "./write-scope.ts";

export type RunKey = "textStyle" | "font" | "letterSpacing" | "textCase" | "textDecoration" | "textFills" | "hyperlink";

type RunWriter = (range: TextRange, props: FigmaProps, scope: WriteScope) => void | Promise<void>;

/**
 * What a run of text sets, in the order Figma needs it (a style first: it resets what it covers), with the segment
 * fields that tell the runs having the text's own value.
 */
export const RUN_FIELDS: readonly (readonly [RunKey, readonly SegmentField[]])[] = [
  ["textStyle", ["textStyleId"]],
  ["font", ["fontName", "fontSize", "lineHeight"]],
  ["letterSpacing", ["letterSpacing"]],
  ["textCase", ["textCase"]],
  ["textDecoration", ["textDecoration"]],
  ["textFills", ["fills", "fillStyleId"]],
  ["hyperlink", ["hyperlink"]],
];

/** How each run property is written over a range. */
export const RUN_WRITERS: Readonly<Record<RunKey, RunWriter>> = {
  textStyle: async (range, { textStyle }, scope) => {
    await range.textStyle(textStyle === "" ? "" : await (await scope.tokens()).textStyle(textStyle ?? ""));
  },
  font: (range, { font: spec }, scope) => {
    if (spec === undefined) {
      return;
    }

    const font = scope.font(spec);

    if (font === undefined || font instanceof WriteError) {
      throw font ?? new WriteError(`${spec.family} was not loaded.`);
    }

    range.font(font, spec.size, spec.lineHeight as LineHeight);
  },
  letterSpacing: (range, { letterSpacing }) => {
    if (letterSpacing !== undefined) {
      range.letterSpacing({ ...letterSpacing });
    }
  },
  textCase: (range, { textCase }) => {
    if (textCase !== undefined) {
      range.textCase(textCase);
    }
  },
  textDecoration: (range, { textDecoration }) => {
    if (textDecoration !== undefined) {
      decorate(range, textDecoration);
    }
  },
  textFills: async (range, { textFills }, scope) => {
    const paints = await paintsOf(textFills ?? [], scope, range.node);

    if ("style" in paints) {
      await range.fillStyle(paints.style);
    } else {
      range.fills(paints.paints);
    }
  },
  hyperlink: (range, { hyperlink }) => {
    range.hyperlink(
      hyperlink === "" || hyperlink === undefined
        ? null
        : {
            type: "URL",
            value: hyperlink,
          },
    );
  },
};
