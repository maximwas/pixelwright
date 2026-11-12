import { describe, expect, it } from "vitest";
import { CSS_ORDER } from "@/core/css/css.constants.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";

describe("CssDeclarations", () => {
  // C-1.4: every read writes a layer's CSS in this one order; design_apply and the goldens rely on it.
  it("pins CSS_ORDER: layout, position, size, spacing, alignment, transform, paint, border, effects, text", () => {
    expect(CSS_ORDER).toEqual([
      "display",
      "flex-direction",
      "flex-wrap",
      "position",
      "left",
      "right",
      "top",
      "bottom",
      "width",
      "height",
      "min-width",
      "max-width",
      "min-height",
      "max-height",
      "flex",
      "align-self",
      "grid-row",
      "grid-column",
      "justify-self",
      "padding",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "justify-content",
      "align-items",
      "align-content",
      "gap",
      "column-gap",
      "row-gap",
      "grid-template-columns",
      "grid-template-rows",
      "transform",
      "opacity",
      "mix-blend-mode",
      "overflow",
      "text-overflow",
      "white-space",
      "border-radius",
      "border",
      "border-top",
      "border-right",
      "border-bottom",
      "border-left",
      "outline",
      "background",
      "background-blend-mode",
      "box-shadow",
      "text-shadow",
      "filter",
      "backdrop-filter",
      "font",
      "letter-spacing",
      "text-transform",
      "text-decoration",
      "text-underline-offset",
      "text-decoration-thickness",
      "text-align",
      "text-wrap",
      "color",
      "-webkit-text-stroke",
      "paint-order",
    ]);
  });

  it("puts the properties in CSS_ORDER whatever order the groups set them in, and keeps the notes as given", () => {
    const css = new CssDeclarations();

    css.set("gap", "8px");
    css.note("gap", "-8px (the children overlap)");
    css.set("display", "flex");
    css.set("padding", "24px");

    expect(css.build()).toEqual({
      properties: [
        ["display", "flex"],
        ["padding", "24px"],
        ["gap", "8px"],
      ],
      notes: [["gap", "-8px (the children overlap)"]],
    });
  });
});
