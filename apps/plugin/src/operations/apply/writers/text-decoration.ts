import type { FigmaProps } from "@pixelwright/core";
import { documentColor } from "../../../figma/color-profile.ts";
import { WriteError } from "../../../figma/write-error.ts";
import type { TextRange } from "./text-range.ts";

/** The whole decoration, as the CSS shorthand resets it: no style is solid, no colour, offset or thickness Figma's own. */
export function decorate(range: TextRange, decoration: NonNullable<FigmaProps["textDecoration"]>): void {
  range.decorationLine(decoration.line);

  if (decoration.line === "NONE") {
    return;
  }

  const style = decoration.style ?? "SOLID";

  if (style === "DASHED") {
    throw new WriteError("Figma underlines solid, wavy or dotted: it has no dashed decoration.");
  }

  range.decorationLook({
    style,
    color: decorationColor(decoration.color),
    offset: { ...(decoration.offset ?? { unit: "AUTO" }) } as TextDecorationOffset,
    thickness: { ...(decoration.thickness ?? { unit: "AUTO" }) } as TextDecorationThickness,
  });
}

function decorationColor(color: NonNullable<FigmaProps["textDecoration"]>["color"]): TextDecorationColor {
  if (color === undefined) {
    return { value: "AUTO" };
  }

  const { r, g, b, a } = documentColor(color);

  return {
    value: {
      type: "SOLID",
      color: {
        r,
        g,
        b,
      },
      opacity: a,
    },
  };
}
