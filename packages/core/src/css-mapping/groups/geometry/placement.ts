import { decimal } from "../../../kernel/numbers.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import type { AxisPlacement } from "../../figma-props.ts";
import type { ReadScope, Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { lengthOf, percentOf } from "../../values/css-values.ts";
import { px } from "../../values/format.ts";
import { hasLayout } from "../layout/layout.ts";
import { transformCss } from "./transform.ts";

/** A size the constraints decide instead of the layer's own: left out (stretched) or a percent (scaled). */
export type SizeOverride = Partial<Record<"width" | "height", string | null>>;

/** One axis of a layer: its start and end edges, its size, and the placement Figma keeps for it. */
interface Axis {
  readonly start: "left" | "top";
  readonly end: "right" | "bottom";
  readonly size: "width" | "height";
  readonly key: "horizontal" | "vertical";
}

/** Where a layer sits on one axis of its parent: its offset from the start, its length, the parent's length. */
interface AxisBox {
  readonly offset: number;
  readonly length: number;
  readonly parentLength: number;
}

/** A placement read from the edges, or why it cannot be. */
type Placement = { readonly placement: AxisPlacement } | { readonly attribute: string; readonly error: string };

const HORIZONTAL: Axis = {
  start: "left",
  end: "right",
  size: "width",
  key: "horizontal",
};

const VERTICAL: Axis = {
  start: "top",
  end: "bottom",
  size: "height",
  key: "vertical",
};

/**
 * How a layer is placed: its transform, and for one placed absolutely (or in a parent without layout) its edges from
 * its constraints. A rotated or mirrored layer turns about its centre in CSS, so the unrotated box is placed with the
 * centres met (Figma's own x and y are the transformed corner, the far one at -180). The read's root sits nowhere.
 */
export function readPlacement({ node, parent, context, css }: ReadScope): SizeOverride {
  const transform = transformCss(node);

  if (transform !== null) {
    css.set("transform", transform);
  }

  if (parent === null || node === context.root || !(node.layoutPositioning === "ABSOLUTE" || !hasLayout(parent))) {
    return {};
  }

  const centre =
    node.bounds === undefined
      ? null
      : {
          x: node.bounds.x + node.bounds.width / 2,
          y: node.bounds.y + node.bounds.height / 2,
        };
  // A group is no frame: its layers keep their place in it whatever their constraints say.
  const constraints = parent.type === "GROUP" ? undefined : node.constraints;

  css.set("position", "absolute");

  return {
    ...placeAxis(css, HORIZONTAL, constraints?.horizontal ?? "MIN", {
      offset: (centre === null ? node.x : centre.x - node.width / 2) - parent.x,
      length: node.width,
      parentLength: parent.width,
    }),
    ...placeAxis(css, VERTICAL, constraints?.vertical ?? "MIN", {
      offset: (centre === null ? node.y : centre.y - node.height / 2) - parent.y,
      length: node.height,
      parentLength: parent.height,
    }),
  };
}

/**
 * One axis of an absolutely placed layer from its constraint: pinned to the start (MIN) or the end (MAX), held at its
 * offset from the centre, stretched between both edges, or scaled as percents of the parent.
 */
function placeAxis(css: CssDeclarations, { start, end, size }: Axis, constraint: string, box: AxisBox): SizeOverride {
  const { offset, length, parentLength } = box;
  const toEnd = parentLength - offset - length;

  if (constraint === "MAX") {
    css.set(end, px(toEnd));
  } else if (constraint === "CENTER") {
    const fromCentre = Math.round(offset - parentLength / 2);

    css.set(start, fromCentre === 0 ? "50%" : `calc(50% ${fromCentre < 0 ? "-" : "+"} ${Math.abs(fromCentre)}px)`);
  } else if (constraint === "STRETCH") {
    css.set(start, px(offset));
    css.set(end, px(toEnd));

    return { [size]: null };
  } else if (constraint === "SCALE" && parentLength > 0) {
    css.set(start, `${decimal((offset / parentLength) * 100)}%`);

    return { [size]: `${decimal((length / parentLength) * 100)}%` };
  } else {
    css.set(start, px(offset));
  }

  return {};
}

/** position and each axis's edges and size written back. */
export const PLACEMENT_RULES: readonly Rule[] = [
  {
    attributes: ["position"],
    write: positionRule,
  },
  {
    attributes: ["position", "left", "right", "width"],
    write: axisRule(HORIZONTAL),
  },
  {
    attributes: ["position", "top", "bottom", "height"],
    write: axisRule(VERTICAL),
  },
];

function positionRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("position");

  if (value === "absolute") {
    out.set("absolute", true, "position");
  } else if (value === "relative" || value === "static") {
    out.set("absolute", false, "position");
  } else {
    out.fail("position", `position="${value}" is not one Figma has: absolute, or relative to flow in the parent.`);
  }
}

/**
 * One axis of a layer: its edges and its size. The element's edges replace the layer's as a pair, so a new right edge
 * unpins the left one; a new size alone keeps the edge the layer is pinned to. A scaled layer's size is its
 * placement's percent.
 */
function axisRule(axis: Axis): Rule["write"] {
  return (input, out) => {
    const placed = writeEdges(axis, input, out);

    if (input.changed(axis.size) && placed?.kind !== "SCALE") {
      writeSize(axis, input, out, placed);
    }
  };
}

/** The axis's placement from its edges, for a layer placed absolutely; edges on a flowing layer are errors. */
function writeEdges(axis: Axis, { own, merged, changed }: WriteInput, out: WriteOutput): AxisPlacement | null {
  const { start, end, size, key } = axis;
  const ownEdges = own(start) !== undefined || own(end) !== undefined;
  const edge = (name: string) => {
    const value = ownEdges ? own(name) : merged(name);

    return value === "auto" ? undefined : value;
  };
  const from = edge(start);
  const to = edge(end);

  if (from === undefined && to === undefined) {
    return null;
  }

  if (merged("position") !== "absolute") {
    for (const name of [start, end].filter((name) => changed(name) && own(name) !== "auto")) {
      out.fail(
        name,
        `${name} places a layer with position="absolute"; this one flows in its parent.`,
        `Add position="absolute", or leave ${name} out.`,
      );
    }

    return null;
  }

  const result = placementOf(axis, from, to, merged(size));

  if ("error" in result) {
    out.fail(result.attribute, result.error);

    return null;
  }

  out.set(key, result.placement, from === undefined ? end : start);

  return result.placement;
}

/** The axis's size: a length or a token, auto as hugging; none of its own while both edges stretch the layer. */
function writeSize(
  { start, end, size }: Axis,
  { own }: WriteInput,
  out: WriteOutput,
  placed: AxisPlacement | null,
): void {
  const value = own(size) ?? "";

  if (placed?.kind === "STRETCH") {
    out.fail(
      size,
      `${size} comes from ${start} and ${end} when both are set: set one of them to auto to size the layer.`,
    );

    return;
  }

  if (value === "auto" || value === "fit-content" || value === "max-content") {
    out.set(size, "HUG", size);

    return;
  }

  const length = lengthOf(value);

  if (length === null) {
    out.fail(
      size,
      `${size}="${value}" is not a length in px, a token or auto.`,
      percentOf(value) === null ? undefined : `A percent scales with the parent: it needs ${start} in percents too.`,
    );
  } else {
    out.set(size, length, size);
  }
}

/** The placement the edges give: from the centre or in percents of the parent (from the start edge), else pixels. */
function placementOf(
  axis: Axis,
  from: string | undefined,
  to: string | undefined,
  size: string | undefined,
): Placement {
  const relative = from === undefined ? null : relativePlacement(axis.start, from, size);

  return relative ?? pixelPlacement(axis, from, to);
}

/** A start edge at `50%` or `calc(50% ± Npx)` (from the centre), or in percents with the size in percents (scaled). */
function relativePlacement(start: string, from: string, size: string | undefined): Placement | null {
  const centre = from === "50%" ? ["", "+", "0"] : /^calc\(\s*50%\s*([+-])\s*(\d*\.?\d+)px\s*\)$/.exec(from);

  if (centre !== null) {
    return {
      placement: {
        kind: "CENTER",
        offset: (centre[1] === "-" ? -1 : 1) * Number(centre[2]) || 0,
      },
    };
  }

  const percent = percentOf(from);

  if (percent === null) {
    return null;
  }

  const sizePercent = size === undefined ? null : percentOf(size);

  return sizePercent === null
    ? {
        attribute: start,
        error: `${start} in percents scales the layer with its parent: give its size in percents too.`,
      }
    : {
        placement: {
          kind: "SCALE",
          start: percent,
          size: sizePercent,
        },
      };
}

/** Edges in pixels: both stretch the layer, one pins it to its side. */
function pixelPlacement({ start, end }: Axis, from: string | undefined, to: string | undefined): Placement {
  const first = pixels(from);
  const last = pixels(to);

  if (first === null) {
    return {
      attribute: start,
      error: `${start}="${from}" is not a length in px, a percent, calc(50% ± Npx) or auto.`,
    };
  }

  if (last === null) {
    return {
      attribute: end,
      error: `${end}="${to}" is not a length in px or auto.`,
    };
  }

  if (first !== undefined && last !== undefined) {
    return {
      placement: {
        kind: "STRETCH",
        start: first,
        end: last,
      },
    };
  }

  return {
    placement:
      first === undefined
        ? {
            kind: "MAX",
            offset: last ?? 0,
          }
        : {
            kind: "MIN",
            offset: first,
          },
  };
}

/** An edge in pixels: undefined when not given, null when not pixels (a token cannot place a layer). */
function pixels(value: string | undefined): number | null | undefined {
  const length = value === undefined ? undefined : lengthOf(value);

  return typeof length === "object" ? null : length;
}
