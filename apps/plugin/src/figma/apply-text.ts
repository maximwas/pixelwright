import type { ApplyChange, FigmaProps } from "@pixelwright/core";
import type { TextLayer, WriteContext } from "../types/apply.ts";
import { set } from "./apply-props.ts";
import { documentColor } from "./color-profile.ts";
import { fontKey } from "./fonts.ts";
import { paintsOf } from "./paints.ts";
import { WriteError } from "./write-error.ts";

type TextKey = "textStyle" | "font" | "letterSpacing" | "textCase" | "textDecoration" | "textFills" | "hyperlink";

/**
 * What a run of text sets, in the order Figma needs it (a style first: it resets what it covers), with the segment
 * fields that tell the runs having the text's own value.
 */
const RUN_PROPS: readonly (readonly [TextKey, readonly string[]])[] = [
  ["textStyle", ["textStyleId"]],
  ["font", ["fontName", "fontSize", "lineHeight"]],
  ["letterSpacing", ["letterSpacing"]],
  ["textCase", ["textCase"]],
  ["textDecoration", ["textDecoration"]],
  ["textFills", ["fills", "fillStyleId"]],
  ["hyperlink", ["hyperlink"]],
];

/** A run's look, kept across new characters: Figma gives new characters the first one's. */
const BASE_FIELDS = [
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
];

/** The look a text style sets: a restored run takes these from its style, not as values over it. */
const STYLED_FIELDS = ["fontName", "fontSize", "lineHeight", "letterSpacing", "textCase", "textDecoration"] as const;

const TEXT_KEYS: readonly (keyof FigmaProps)[] = [
  ...RUN_PROPS.map(([key]) => key),
  "textAlignHorizontal",
  "textWrapStyle",
  "truncate",
];

export function hasTextProps(props: FigmaProps): boolean {
  return TEXT_KEYS.some((key) => props[key] !== undefined);
}

/**
 * A text's characters, its own look, its runs and the box's text settings. New characters keep the look the text
 * had (its longest run's); the text's own properties go to the runs that had its own value, as CSS inherits; the
 * spans then set theirs. Each property in its own try: `fail` gets the property and the error.
 */
export async function writeText(
  node: TextLayer,
  change: ApplyChange,
  context: WriteContext,
  fail: (key: keyof FigmaProps | "text", error: unknown) => void,
): Promise<boolean> {
  let wrote = false;

  if (change.text !== undefined) {
    try {
      const segments = node.getStyledTextSegments(BASE_FIELDS);
      const base = longest(segments);
      const retyped = node.characters !== change.text.characters;

      if (retyped) {
        const unloaded = fontsOf(node).find((font) => context.unloaded.has(`${font.family} ${font.style}`));

        if (unloaded !== undefined) {
          throw new WriteError(
            `The text uses ${unloaded.family} ${unloaded.style}, which this Figma cannot load: its characters cannot change.`,
            "Install the font, or give the text a font this Figma has first.",
          );
        }

        setCharacters(node, change.text.characters);
      }

      // New characters take the first one's look, which for one run is the text's own. A text of several runs takes
      // its own look again over all of it, so a span removed or moved leaves nothing behind; the spans come after.
      if (segments.length > 1 && base !== undefined && node.characters.length > 0) {
        await restore(node, base);
      }

      wrote ||= retyped || segments.length > 1;
    } catch (error) {
      fail("text", error);

      return wrote;
    }
  }

  for (const [key, fields] of RUN_PROPS) {
    if (change.props[key] !== undefined) {
      try {
        await inherit(node, fields, (start, end) => setRun(node, key, change.props, start, end, context));
        wrote = true;
      } catch (error) {
        fail(key, error);
      }
    }
  }

  for (const run of change.text?.runs ?? []) {
    for (const [key] of RUN_PROPS) {
      if (run.props[key] !== undefined && run.end > run.start) {
        try {
          await setRun(node, key, run.props, run.start, run.end, context);
          wrote = true;
        } catch (error) {
          fail(key, error);
        }
      }
    }
  }

  for (const [key, write] of [
    ["textAlignHorizontal", () => set(node, "textAlignHorizontal", change.props.textAlignHorizontal)],
    ["textWrapStyle", () => set(node, "textWrapStyle", change.props.textWrapStyle)],
    [
      "truncate",
      () => {
        set(node, "textTruncation", change.props.truncate ? "ENDING" : "DISABLED");
        set(node, "maxLines", change.props.truncate ? 1 : null);
      },
    ],
  ] as const) {
    if (change.props[key] !== undefined) {
      try {
        write();
        wrote = true;
      } catch (error) {
        fail(key, error);
      }
    }
  }

  return wrote;
}

/** The fonts a text uses: an empty one through its own fontName, since Figma refuses a range of no characters. */
function fontsOf(node: TextLayer): FontName[] {
  if (node.characters.length > 0) {
    return node.getRangeAllFontNames(0, node.characters.length);
  }

  return typeof node.fontName === "object" && node.fontName !== null ? [node.fontName as FontName] : [];
}

function longest<T extends { start: number; end: number }>(segments: readonly T[]): T | undefined {
  return segments.reduce<T | undefined>(
    (best, segment) => (best === undefined || segment.end - segment.start > best.end - best.start ? segment : best),
    undefined,
  );
}

/**
 * Characters through the component property they are bound to, when an instance holds it (written on the text
 * itself they would not stick); otherwise on the text, an override inside an instance.
 */
function setCharacters(node: TextLayer, characters: string): void {
  const key = (node.componentPropertyReferences as { characters?: string } | null | undefined)?.characters;

  for (let owner = node.parent; key !== undefined && owner !== null; owner = owner.parent) {
    if (owner.type === "INSTANCE" && Object.hasOwn((owner.componentProperties as object | undefined) ?? {}, key)) {
      owner.setProperties({ [key]: characters });

      return;
    }
  }

  node.characters = characters;
}

/**
 * The look the text had, over all of it again: its style, then what the style does not set or sets otherwise, its
 * colour, link and the variables bound to its type, so a style and its bindings stay.
 */
async function restore(node: TextLayer, base: Record<string, unknown>): Promise<void> {
  const end = node.characters.length;
  const styleId = typeof base.textStyleId === "string" && base.textStyleId !== "" ? base.textStyleId : null;
  const style = styleId === null ? null : ((await figma.getStyleByIdAsync(styleId)) as TextStyle | null);

  if (styleId !== null) {
    await node.setRangeTextStyleIdAsync(0, end, styleId);
  }

  const writers: Record<(typeof STYLED_FIELDS)[number], (value: never) => void> = {
    fontName: (value) => node.setRangeFontName(0, end, value),
    fontSize: (value) => node.setRangeFontSize(0, end, value),
    lineHeight: (value) => node.setRangeLineHeight(0, end, value),
    letterSpacing: (value) => node.setRangeLetterSpacing(0, end, value),
    textCase: (value) => node.setRangeTextCase(0, end, value),
    textDecoration: (value) => node.setRangeTextDecoration(0, end, value),
  };

  for (const field of STYLED_FIELDS) {
    const value = base[field];

    if (value !== undefined && (style === null || JSON.stringify(style[field]) !== JSON.stringify(value))) {
      writers[field](value as never);
    }
  }

  if (typeof base.fillStyleId === "string" && base.fillStyleId !== "") {
    await node.setRangeFillStyleIdAsync(0, end, base.fillStyleId);
  } else if (Array.isArray(base.fills)) {
    node.setRangeFills(0, end, base.fills as Paint[]);
  }

  if (base.hyperlink !== undefined) {
    node.setRangeHyperlink(0, end, (base.hyperlink as HyperlinkTarget | null) ?? null);
  }

  for (const [field, alias] of Object.entries((base.boundVariables as Record<string, unknown> | undefined) ?? {})) {
    const id = (alias as { id?: unknown } | undefined)?.id;
    const variable = typeof id === "string" ? await figma.variables.getVariableByIdAsync(id) : null;

    if (variable !== null && field !== "fills") {
      node.setRangeBoundVariable(0, end, field as VariableBindableTextField, variable);
    }
  }
}

/** The runs that have the text's own value of these fields (all of an empty text). */
async function inherit(
  node: TextLayer,
  fields: readonly string[],
  write: (start: number, end: number) => Promise<void>,
): Promise<void> {
  if (node.characters.length === 0) {
    await write(0, 0);

    return;
  }

  const segments = node.getStyledTextSegments([...fields]);
  const value = (segment: Record<string, unknown>) => JSON.stringify(fields.map((field) => segment[field]));
  const base = longest(segments);

  for (const segment of segments) {
    if (base !== undefined && value(segment) === value(base)) {
      await write(segment.start, segment.end);
    }
  }
}

/** One property over a range; an empty text (start equal to end) takes it on the node itself. */
async function setRun(
  node: TextLayer,
  key: TextKey,
  props: FigmaProps,
  start: number,
  end: number,
  context: WriteContext,
): Promise<void> {
  const whole = start === end;

  if (key === "textStyle") {
    const id = props.textStyle === "" ? "" : await (await context.tokens()).textStyle(props.textStyle ?? "");

    await (whole ? node.setTextStyleIdAsync(id) : node.setRangeTextStyleIdAsync(start, end, id));
  } else if (key === "font" && props.font !== undefined) {
    const font = context.fonts.get(fontKey(props.font));

    if (font === undefined || font instanceof WriteError) {
      throw font ?? new WriteError(`${props.font.family} was not loaded.`);
    }

    const lineHeight = props.font.lineHeight as LineHeight;

    if (whole) {
      node.fontName = font;
      node.fontSize = props.font.size;
      node.lineHeight = lineHeight;
    } else {
      node.setRangeFontName(start, end, font);
      node.setRangeFontSize(start, end, props.font.size);
      node.setRangeLineHeight(start, end, lineHeight);
    }
  } else if (key === "letterSpacing" && props.letterSpacing !== undefined) {
    const spacing = { ...props.letterSpacing };

    if (whole) {
      node.letterSpacing = spacing;
    } else {
      node.setRangeLetterSpacing(start, end, spacing);
    }
  } else if (key === "textCase" && props.textCase !== undefined) {
    if (whole) {
      node.textCase = props.textCase;
    } else {
      node.setRangeTextCase(start, end, props.textCase);
    }
  } else if (key === "textDecoration" && props.textDecoration !== undefined) {
    decorate(node, props.textDecoration, start, end);
  } else if (key === "textFills") {
    const paints = await paintsOf(props.textFills ?? [], context);

    if ("style" in paints) {
      await (whole ? node.setFillStyleIdAsync(paints.style) : node.setRangeFillStyleIdAsync(start, end, paints.style));
    } else {
      if (whole) {
        node.fills = paints.paints;
      } else {
        node.setRangeFills(start, end, paints.paints);
      }
    }
  } else if (key === "hyperlink") {
    const link: HyperlinkTarget | null =
      props.hyperlink === "" || props.hyperlink === undefined
        ? null
        : {
            type: "URL",
            value: props.hyperlink,
          };

    if (whole) {
      node.hyperlink = link;
    } else {
      node.setRangeHyperlink(start, end, link);
    }
  }
}

/** The whole decoration, as the CSS shorthand resets it: no style is solid, no colour, offset or thickness Figma's own. */
function decorate(
  node: TextLayer,
  decoration: NonNullable<FigmaProps["textDecoration"]>,
  start: number,
  end: number,
): void {
  const whole = start === end;

  if (whole) {
    node.textDecoration = decoration.line;
  } else {
    node.setRangeTextDecoration(start, end, decoration.line);
  }

  if (decoration.line === "NONE") {
    return;
  }

  const style = decoration.style ?? "SOLID";

  if (style === "DASHED") {
    throw new WriteError("Figma underlines solid, wavy or dotted: it has no dashed decoration.");
  }

  const written = decoration.color === undefined ? null : documentColor(decoration.color);
  const color: TextDecorationColor = {
    value:
      written === null
        ? "AUTO"
        : {
            type: "SOLID",
            color: {
              r: written.r,
              g: written.g,
              b: written.b,
            },
            opacity: written.a,
          },
  };
  const offset = { ...(decoration.offset ?? { unit: "AUTO" }) } as TextDecorationOffset;
  const thickness = { ...(decoration.thickness ?? { unit: "AUTO" }) } as TextDecorationThickness;

  if (whole) {
    node.textDecorationStyle = style;
    node.textDecorationColor = color;
    node.textDecorationOffset = offset;
    node.textDecorationThickness = thickness;
  } else {
    node.setRangeTextDecorationStyle(start, end, style);
    node.setRangeTextDecorationColor(start, end, color);
    node.setRangeTextDecorationOffset(start, end, offset);
    node.setRangeTextDecorationThickness(start, end, thickness);
  }
}
