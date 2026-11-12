import { Color } from "../../../kernel/color/color.ts";
import { roundTo } from "../../../kernel/numbers.ts";
import type { FigmaProps, TextLength } from "../../figma-props.ts";
import { keywordRule } from "../../keyword-rule.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { lengthOf, splitTop } from "../../values/css-values.ts";
import { fontOf, textLengthOf } from "../../values/fonts.ts";
import { TEXT_COLOR_RULE } from "../paint/fills.ts";

const DECORATION = ["text-decoration", "text-underline-offset", "text-decoration-thickness"];

const CASE_FIGMA: Readonly<Record<string, Exclude<FigmaProps["textCase"], undefined>>> = {
  none: "ORIGINAL",
  uppercase: "UPPER",
  lowercase: "LOWER",
  capitalize: "TITLE",
};

const ALIGN_FIGMA: Readonly<Record<string, Exclude<FigmaProps["textAlignHorizontal"], undefined>>> = {
  left: "LEFT",
  start: "LEFT",
  center: "CENTER",
  right: "RIGHT",
  end: "RIGHT",
  justify: "JUSTIFIED",
};

const WRAP_FIGMA: Readonly<Record<string, Exclude<FigmaProps["textWrapStyle"], undefined>>> = {
  wrap: "AUTO",
  balance: "BALANCE",
  pretty: "PRETTY",
};

const LINES: Readonly<Record<string, "NONE" | "UNDERLINE" | "STRIKETHROUGH">> = {
  none: "NONE",
  underline: "UNDERLINE",
  "line-through": "STRIKETHROUGH",
};

const DECORATION_STYLES: Readonly<Record<string, "SOLID" | "WAVY" | "DOTTED" | "DASHED">> = {
  solid: "SOLID",
  wavy: "WAVY",
  dotted: "DOTTED",
  dashed: "DASHED",
};

/** The decoration's offset and thickness, beside the shorthand, as the decoration Figma keeps them in. */
const DECORATION_LENGTHS = [
  ["text-underline-offset", "offset"],
  ["text-decoration-thickness", "thickness"],
] as const;

/** What a Text and its spans set; those a text style covers are written again when the style changes. */
export const TEXT_RULES: readonly Rule[] = [
  {
    attributes: ["textStyle"],
    write: ({ own }, out) => out.set("textStyle", own("textStyle") ?? "", "textStyle"),
  },
  {
    attributes: ["font"],
    styled: true,
    write: fontRule,
  },
  {
    attributes: ["letter-spacing"],
    styled: true,
    write: letterSpacingRule,
  },
  {
    attributes: ["text-transform"],
    styled: true,
    write: keywordRule("text-transform", CASE_FIGMA, "textCase"),
  },
  {
    attributes: DECORATION,
    styled: true,
    write: decorationRule,
  },
  {
    attributes: ["text-align"],
    write: keywordRule("text-align", ALIGN_FIGMA, "textAlignHorizontal"),
  },
  {
    attributes: ["text-wrap"],
    write: keywordRule("text-wrap", WRAP_FIGMA, "textWrapStyle"),
  },
  TEXT_COLOR_RULE,
];

function fontRule({ own, tag }: WriteInput, out: WriteOutput): void {
  const value = own("font") ?? "";
  const font = fontOf(value);

  if (font === null) {
    out.fail("font", `font="${value}" is not "[italic] weight size/line-height 'Family'".`);
  } else if (tag === "TextPath" && font.lineHeight.unit !== "AUTO") {
    // Figma would take the font and drop the line height, so the same call would be "changed" every time.
    out.fail(
      "font",
      "A text path has no line height.",
      `Give its font without one: font="${value.replace(/\s*\/\s*\S+/, "")}".`,
    );
  } else {
    out.set("font", font, "font");
  }
}

/** Letter spacing in em (Figma's percent of the font size) or px. */
function letterSpacingRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("letter-spacing") ?? "";
  const em = /^(-?\d*\.?\d+)em$/.exec(value);
  const pixels = value === "normal" ? 0 : lengthOf(value);

  if (em !== null) {
    out.set(
      "letterSpacing",
      {
        unit: "PERCENT",
        value: roundTo(Number(em[1]) * 100, 4),
      },
      "letter-spacing",
    );
  } else if (typeof pixels === "number") {
    out.set(
      "letterSpacing",
      {
        unit: "PIXELS",
        value: pixels,
      },
      "letter-spacing",
    );
  } else {
    out.fail("letter-spacing", `letter-spacing="${value}" is not in em or px.`);
  }
}

/** The decoration as one: the shorthand's line, style and colour, with the offset and thickness beside it. */
function decorationRule({ merged, changed }: WriteInput, out: WriteOutput): void {
  const value = merged("text-decoration");
  const words = value === undefined ? [] : splitTop(value, " ");
  const line = words.find((word) => LINES[word] !== undefined);
  const style = words.find((word) => DECORATION_STYLES[word] !== undefined);
  const rest = words.filter((word) => word !== line && word !== style).join(" ");
  const color = rest === "" ? null : Color.parse(rest);

  if (value !== undefined && (line === undefined || (rest !== "" && color === null))) {
    out.fail("text-decoration", `text-decoration="${value}" is not "underline|line-through|none [style] [colour]".`);

    return;
  }

  const lengths = decorationLengths(merged, out);

  if (lengths !== null) {
    out.set(
      "textDecoration",
      {
        line: LINES[line ?? "none"] ?? "NONE",
        ...(style === undefined ? {} : { style: DECORATION_STYLES[style] ?? "SOLID" }),
        ...(color === null ? {} : { color: color.value() }),
        ...lengths,
      },
      DECORATION.find(changed) ?? "text-decoration",
    );
  }
}

/** The offset and thickness given, in px or em, or auto; null after one that is neither. */
function decorationLengths(
  merged: AttributeReader,
  out: WriteOutput,
): { offset?: TextLength; thickness?: TextLength } | null {
  const lengths: { offset?: TextLength; thickness?: TextLength } = {};

  for (const [attribute, key] of DECORATION_LENGTHS) {
    const length = merged(attribute);
    const read = length === undefined ? undefined : textLengthOf(length);

    if (read === null) {
      out.fail(attribute, `${attribute}="${length}" is not a length in px or em, or auto.`);

      return null;
    }

    if (read !== undefined) {
      lengths[key] = read;
    }
  }

  return lengths;
}
