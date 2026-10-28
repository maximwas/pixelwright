import { sameValue } from "@pixelwright/core";
import type { TextLayer } from "../../../figma/capabilities.ts";
import type { IdLookup } from "../../../figma/id-lookup.ts";

/** A field of a styled text segment. */
export type SegmentField = keyof Omit<StyledTextSegment, "characters" | "start" | "end">;

/** A run's look, kept across new characters: Figma gives new characters the first one's. */
export const BASE_FIELDS = [
  "fontName",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textCase",
  "textDecoration",
  "fills",
  "fillStyleId",
  "textStyleId",
  "hyperlink",
  "boundVariables",
] satisfies SegmentField[];

export type BaseSegment = Pick<StyledTextSegment, (typeof BASE_FIELDS)[number] | "start" | "end">;

/** The look a text style sets: a restored run takes these from its style, not as values over it. */
const STYLED_FIELDS = ["fontName", "fontSize", "lineHeight", "letterSpacing", "textCase", "textDecoration"] as const;

type StyledField = (typeof STYLED_FIELDS)[number];

/** Each styled field written over a text; a text on a path has no line height or decoration to restore. */
const STYLED_WRITERS: {
  readonly [F in StyledField]: (node: TextLayer, end: number, value: BaseSegment[F]) => void;
} = {
  fontName: (node, end, value) => node.setRangeFontName(0, end, value),
  fontSize: (node, end, value) => node.setRangeFontSize(0, end, value),
  lineHeight: (node, end, value) => {
    if (node.type === "TEXT") {
      node.setRangeLineHeight(0, end, value);
    }
  },
  letterSpacing: (node, end, value) => node.setRangeLetterSpacing(0, end, value),
  textCase: (node, end, value) => node.setRangeTextCase(0, end, value),
  textDecoration: (node, end, value) => {
    if (node.type === "TEXT") {
      node.setRangeTextDecoration(0, end, value);
    }
  },
};

/** The run of most characters: the text's own look. */
export function longest<T extends { start: number; end: number }>(segments: readonly T[]): T | undefined {
  return segments.reduce<T | undefined>(
    (best, segment) => (best === undefined || segment.end - segment.start > best.end - best.start ? segment : best),
    undefined,
  );
}

/**
 * The look the text had, over all of it again: its style, then what the style does not set or sets otherwise, its
 * colour, link and the variables bound to its type, so a style and its bindings stay.
 */
export async function restoreLook(node: TextLayer, base: BaseSegment, lookup: IdLookup): Promise<void> {
  const end = node.characters.length;
  const styleId = typeof base.textStyleId === "string" && base.textStyleId !== "" ? base.textStyleId : null;
  const style = styleId === null ? null : ((await lookup.style(styleId)) as TextStyle | null);

  if (styleId !== null) {
    await node.setRangeTextStyleIdAsync(0, end, styleId);
  }

  for (const field of STYLED_FIELDS) {
    restoreField(node, end, field, {
      base,
      style,
    });
  }

  await restoreFillAndLink(node, base, end);
  await restoreBindings(node, base, {
    end,
    lookup,
  });
}

/** A field the style does not set, or sets otherwise, written over the text. */
function restoreField<F extends StyledField>(
  node: TextLayer,
  end: number,
  field: F,
  { base, style }: { readonly base: BaseSegment; readonly style: TextStyle | null },
): void {
  const value = base[field];

  if (value !== undefined && (style === null || !sameValue(style[field], value))) {
    STYLED_WRITERS[field](node, end, value);
  }
}

async function restoreFillAndLink(node: TextLayer, base: BaseSegment, end: number): Promise<void> {
  if (typeof base.fillStyleId === "string" && base.fillStyleId !== "") {
    await node.setRangeFillStyleIdAsync(0, end, base.fillStyleId);
  } else if (Array.isArray(base.fills)) {
    node.setRangeFills(0, end, base.fills);
  }

  if (base.hyperlink !== undefined) {
    node.setRangeHyperlink(0, end, base.hyperlink ?? null);
  }
}

async function restoreBindings(
  node: TextLayer,
  base: BaseSegment,
  { end, lookup }: { end: number; lookup: IdLookup },
): Promise<void> {
  for (const [field, alias] of Object.entries(base.boundVariables ?? {})) {
    const id = (alias as { id?: unknown } | undefined)?.id;
    const variable = typeof id === "string" ? await lookup.variable(id) : null;

    if (variable !== null && field !== "fills") {
      node.setRangeBoundVariable(0, end, field as VariableBindableTextField, variable);
    }
  }
}

/** Writes over the runs that have the text's own value of these fields (all of an empty text). */
export async function inherit(
  node: TextLayer,
  fields: readonly SegmentField[],
  write: (start: number, end: number) => Promise<void>,
): Promise<void> {
  if (node.characters.length === 0) {
    await write(0, 0);

    return;
  }

  const segments = node.getStyledTextSegments([...fields]);
  const value = (segment: (typeof segments)[number]) => fields.map((field) => segment[field]);
  const base = longest(segments);

  for (const segment of segments) {
    if (base !== undefined && sameValue(value(segment), value(base))) {
      await write(segment.start, segment.end);
    }
  }
}
