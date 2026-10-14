import { keywordRule } from "../../keyword-rule.ts";
import type { ReadScope, Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { lengthOf, numberOf } from "../../values/css-values.ts";
import { isFlex } from "../layout/layout.ts";
import type { SizeOverride } from "./placement.ts";
import { SELF_FIGMA } from "./self-align.ts";

/** The limits a layer's size may have, as CSS and Figma name them. */
const LIMITS = [
  ["min-width", "minWidth"],
  ["max-width", "maxWidth"],
  ["min-height", "minHeight"],
  ["max-height", "maxHeight"],
] as const;

/** One axis's size as Figma keeps it: the CSS property, the sizing, the length, and whether it is the parent's direction. */
interface AxisSize {
  readonly property: "width" | "height";
  readonly sizing: string | undefined;
  readonly value: number;
  readonly mainAxis: boolean;
}

/**
 * A layer's size: its own where it is fixed (the read's root always), filling its flex parent as flex: 1 along the
 * parent's direction and align-self: stretch across it; a size its constraints decide instead; and its limits.
 */
export function readSize(scope: ReadScope, override: SizeOverride): void {
  const { node, parent, css } = scope;

  readAxisSize(
    scope,
    {
      property: "width",
      sizing: node.layoutSizingHorizontal,
      value: node.width,
      mainAxis: parent?.layoutMode === "HORIZONTAL",
    },
    override.width,
  );
  readAxisSize(
    scope,
    {
      property: "height",
      sizing: node.layoutSizingVertical,
      value: node.height,
      mainAxis: parent?.layoutMode === "VERTICAL",
    },
    override.height,
  );

  for (const [property, key] of LIMITS) {
    css.setLength(property, key, node[key]);
  }
}

/** One axis's size; `decided` is the size the constraints gave instead (null: none of its own). */
function readAxisSize(
  { node, parent, context, css }: ReadScope,
  axis: AxisSize,
  decided: string | null | undefined,
): void {
  if (decided !== undefined) {
    if (decided !== null) {
      css.set(axis.property, decided);
    }

    return;
  }

  if (node === context.root || axis.sizing === "FIXED" || axis.sizing === undefined) {
    css.setLength(axis.property, axis.property, axis.value);
  } else if (axis.sizing === "FILL" && isFlex(parent) && node.layoutPositioning !== "ABSOLUTE") {
    css.set(axis.mainAxis ? "flex" : "align-self", axis.mainAxis ? "1" : "stretch");
  }
}

/** The limits, filling the parent's direction, and alignment across it, written back. */
export const SIZE_RULES: readonly Rule[] = [
  ...LIMITS.map(
    ([attribute, key]): Rule => ({
      attributes: [attribute],
      write: limitRule(attribute, key),
    }),
  ),
  {
    attributes: ["flex"],
    write: growRule,
  },
  {
    attributes: ["align-self"],
    write: keywordRule("align-self", SELF_FIGMA, "alignSelf"),
  },
];

/** A limit: a length or a token; none, auto or 0 takes it away. */
function limitRule(attribute: string, key: (typeof LIMITS)[number][1]): Rule["write"] {
  return ({ own }, out) => {
    const value = own(attribute) ?? "";
    const length = lengthOf(value);

    if (value === "none" || value === "auto" || length === 0) {
      out.set(key, null, attribute);
    } else if (length === null) {
      out.fail(attribute, `${attribute}="${value}" is not a length in px, a token or none.`);
    } else {
      out.set(key, length, attribute);
    }
  };
}

/** flex: 1 fills the flex parent's direction, none (or 0) does not; Figma has no grow weights. */
function growRule({ own }: WriteInput, out: WriteOutput): void {
  const value = (own("flex") ?? "").trim().replace(/\s+/g, " ");
  const grow = value === "none" || value === "initial" ? 0 : value === "auto" ? 1 : numberOf(value.split(" ")[0] ?? "");

  if (grow === 0 || grow === 1) {
    out.set("grow", grow === 1, "flex");
  } else {
    out.fail(
      "flex",
      `flex="${value}": a layer fills its parent's direction or not, flex="1" or flex="none" (Figma has no grow weights).`,
    );
  }
}
