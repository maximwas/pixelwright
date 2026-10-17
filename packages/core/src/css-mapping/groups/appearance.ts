import { decimal } from "../../kernel/numbers.ts";
import { MIXED } from "../../schemas/snapshot-values.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import type { CssDeclarations } from "../css-declarations.ts";
import type { Rule, WriteInput, WriteOutput } from "../property-group.ts";
import { boxOf, numberOf, percentOf, pixelLengthOf, splitTop } from "../values/css-values.ts";
import { px } from "../values/format.ts";

const RADII = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

/** Figma's blend modes as CSS's mix-blend-mode (Figma's linear burn and dodge are CSS's plus-darker and plus-lighter). */
const BLEND_CSS: Readonly<Record<string, string>> = {
  DARKEN: "darken",
  MULTIPLY: "multiply",
  COLOR_BURN: "color-burn",
  LINEAR_BURN: "plus-darker",
  LIGHTEN: "lighten",
  SCREEN: "screen",
  COLOR_DODGE: "color-dodge",
  LINEAR_DODGE: "plus-lighter",
  OVERLAY: "overlay",
  SOFT_LIGHT: "soft-light",
  HARD_LIGHT: "hard-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity",
};

/** CSS's mix-blend-mode as Figma's blend mode. */
const BLEND_FIGMA: Readonly<Record<string, string>> = Object.fromEntries([
  ["normal", "NORMAL"],
  ...Object.entries(BLEND_CSS).map(([figma, css]) => [css, figma]),
]);

/**
 * How a layer shows as a whole: its opacity, its blend mode, whether it clips its content. A mask is the element's
 * mask attribute (it clips the layers above it; a mask group as a whole is exported as one image).
 */
export function readAppearance(node: SnapshotNode, css: CssDeclarations): void {
  if (node.opacity !== undefined) {
    css.set("opacity", decimal(node.opacity));
  }

  const blend = node.blendMode === undefined ? undefined : BLEND_CSS[node.blendMode];

  if (blend !== undefined) {
    css.set("mix-blend-mode", blend);
  } else if (node.blendMode !== undefined) {
    css.readOnly("mix-blend-mode", node.css?.["mix-blend-mode"] ?? node.blendMode.toLowerCase().replaceAll("_", "-"));
  }

  if (node.clipsContent) {
    css.set("overflow", "hidden");
  }
}

/** A box's corners: an ellipse is round, else one radius or four, each a length or a token. */
export function readRadius(node: SnapshotNode, css: CssDeclarations): void {
  if (node.type === "ELLIPSE") {
    css.set("border-radius", "50%");

    return;
  }

  if (node.cornerRadius === MIXED) {
    css.set("border-radius", RADII.map((key) => css.length(key, node[key] ?? 0)).join(" "));
  } else if (node.cornerRadius !== undefined) {
    css.setLength("border-radius", "topLeftRadius", node.cornerRadius);
  }
}

/** A frame's visible layout grids, read-only: the columns, rows or square grid the design is laid on. */
export function readLayoutGrids(node: SnapshotNode, css: CssDeclarations): void {
  const grids = (node.layoutGrids ?? []).filter((grid) => grid.visible ?? true).map(layoutGridText);

  if (grids.length > 0) {
    css.readOnly("layout-grid", grids.join(" + "));
  }
}

function layoutGridText(grid: NonNullable<SnapshotNode["layoutGrids"]>[number]): string {
  if (grid.pattern === "GRID") {
    return `${px(grid.sectionSize ?? 0)} grid`;
  }

  const unit = grid.pattern === "ROWS" ? "rows" : "columns";
  const alignment = (grid.alignment ?? "STRETCH").toLowerCase();
  const width = alignment === "stretch" ? "" : ` ${px(grid.sectionSize ?? 0)} wide`;
  const edge =
    alignment === "center" ? "" : `, ${alignment === "stretch" ? "margin" : "offset"} ${px(grid.offset ?? 0)}`;

  return `${grid.count ?? 1} ${unit} ${alignment}${width}, gutter ${px(grid.gutterSize ?? 0)}${edge}`;
}

/** Opacity, the blend mode, clipping and a text's truncation, and the corners, written back. */
export const APPEARANCE_RULES: readonly Rule[] = [
  {
    attributes: ["opacity"],
    write: opacityRule,
  },
  {
    attributes: ["mix-blend-mode"],
    write: ({ own }, out) => {
      const value = (own("mix-blend-mode") ?? "").trim().toLowerCase();
      const mode = BLEND_FIGMA[value];

      if (mode === undefined) {
        out.fail(
          "mix-blend-mode",
          `mix-blend-mode="${value}" is no blend mode Figma has.`,
          `Figma has normal, ${Object.values(BLEND_CSS).join(", ")}.`,
        );
      } else {
        out.set("blendMode", mode, "mix-blend-mode");
      }
    },
  },
  {
    attributes: ["overflow", "text-overflow", "white-space"],
    write: overflowRule,
  },
  {
    attributes: ["border-radius"],
    write: radiusRule,
  },
];

function opacityRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("opacity") ?? "";
  const percent = percentOf(value);
  const opacity = percent === null ? numberOf(value) : percent / 100;

  if (opacity === null) {
    out.fail("opacity", `opacity="${value}" is not a number from 0 to 1 or a percent.`);
  } else {
    out.set("opacity", Math.min(1, Math.max(0, opacity)), "opacity");
  }
}

/** A frame clips its content or not; a text truncates on one line with an ellipsis, all three attributes together. */
function overflowRule({ tag, own, merged, changed }: WriteInput, out: WriteOutput): void {
  if (tag === "Text") {
    out.set(
      "truncate",
      merged("text-overflow") === "ellipsis",
      changed("text-overflow") ? "text-overflow" : "overflow",
    );

    return;
  }

  for (const name of ["text-overflow", "white-space"].filter(changed)) {
    out.fail(name, `${name} truncates a Text; a ${tag} clips its content with overflow="hidden".`);
  }

  const value = own("overflow");

  if (value === undefined) {
    return;
  }

  if (value === "hidden" || value === "clip" || value === "visible") {
    out.set("clipsContent", value !== "visible", "overflow");
  } else {
    out.fail(
      "overflow",
      `overflow="${value}": Figma clips a frame's content or not, hidden or visible (scrolling is a prototype setting).`,
    );
  }
}

function radiusRule({ tag, own }: WriteInput, out: WriteOutput): void {
  const value = own("border-radius") ?? "";

  if (tag === "Ellipse" && value === "50%") {
    // An ellipse's own shape.
    return;
  }

  const corners = value.includes("/") ? null : boxOf(splitTop(value, " ").map(pixelLengthOf));

  if (corners === null) {
    out.fail("border-radius", `border-radius="${value}" is not 1 to 4 lengths in px or tokens.`);
  } else {
    out.set("cornerRadius", corners.every((corner) => corner === corners[0]) ? corners[0] : corners, "border-radius");
  }
}
