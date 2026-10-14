import type { FigmaProps } from "@pixelwright/core";
import { documentColor } from "../../../figma/color-profile.ts";
import { WriteError } from "../../../figma/write-error.ts";
import type { TextRange } from "./text-range.ts";

/** The whole decoration, as the CSS shorthand resets it: no style is solid, no colour, offset or thickness Figma's own. */
export function decorate(range: TextRange, decoration: NonNullable<FigmaProps["textDecoration"]>): void {
  if (decoration.line === "NONE") {
    range.decorationLine("NONE");

    return;
  }

  const style = decoration.style ?? "SOLID";

  // Refused before any of it is written: a dashed line would otherwise be left solid.
  if (style === "DASHED") {
    throw dashedRefusal();
  }

  range.decorationLine(decoration.line);
  range.decorationLook({
    style,
    color: decorationColor(decoration.color),
    offset: { ...(decoration.offset ?? { unit: "AUTO" }) } as TextDecorationOffset,
    thickness: { ...(decoration.thickness ?? { unit: "AUTO" }) } as TextDecorationThickness,
  });
}

/** A decoration Figma cannot draw is refused, by the write and by a dry run alike. */
export function checkDecoration(decoration: NonNullable<FigmaProps["textDecoration"]>): void {
  if (decoration.line !== "NONE" && decoration.style === "DASHED") {
    throw dashedRefusal();
  }
}

function dashedRefusal(): WriteError {
  return new WriteError("Figma underlines solid, wavy or dotted: it has no dashed decoration.");
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
