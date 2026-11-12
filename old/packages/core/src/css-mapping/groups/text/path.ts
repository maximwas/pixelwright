import type { FigmaProps } from "../../figma-props.ts";
import type { Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { degreesOf, numberOf, pixelLengthOf } from "../../values/css-values.ts";
import { arcPath, figmaPath, startAlong } from "../../values/paths.ts";

/** Figma makes a text on a path from a vector, and its path stays as made. */
const MADE_PATH = "Figma cannot change a text path's path: delete it and make it again.";

/** The edges an arc places its layer by itself. */
const EDGES = ["left", "top", "right", "bottom"] as const;

/** Where along its path, as a share of the length, text-align anchors a text on a path that gives no start. */
const ALIGN_SHARE: Readonly<Record<string, number>> = {
  center: 0.5,
  right: 1,
  end: 1,
};

/** A TextPath's own attributes written back: the path it is made along (d, or arc), and where its text starts. */
export const TEXT_PATH_RULES: readonly Rule[] = [
  {
    attributes: ["d"],
    write: pathRule,
  },
  {
    attributes: ["arc"],
    write: arcRule,
  },
  {
    attributes: ["start"],
    write: startRule,
  },
  {
    attributes: ["text-align"],
    write: alignedStartRule,
  },
];

function pathRule({ own, existing }: WriteInput, out: WriteOutput): void {
  const value = own("d") ?? "";
  const path = figmaPath(value);

  if (existing) {
    out.fail("d", "d is the path this <TextPath> was made along: it stays as it is.", MADE_PATH);
  } else if (path === null) {
    out.fail(
      "d",
      `d="${value}" is no SVG path that draws a line.`,
      'Start it with M: d="M 0 100 C 50 0 150 0 200 100".',
    );
  } else {
    out.set("path", path, "d");
  }
}

/** An arc of a circle in the parent: the path in the box it covers, the layer placed there absolutely. */
function arcRule({ own, existing }: WriteInput, out: WriteOutput): void {
  const value = own("arc") ?? "";
  const arc = arcOf(value);

  if (existing) {
    out.fail("arc", "arc draws the path of a new <TextPath>: this one has its path.", MADE_PATH);
  } else if (own("d") !== undefined || EDGES.some((edge) => own(edge) !== undefined)) {
    out.fail("arc", "arc places the path in its parent itself: give no d, left, top, right or bottom with it.");
  } else if (arc === null) {
    out.fail(
      "arc",
      `arc="${value}" is no arc: it is the centre's x and y and the radius in px, then from and to in degrees.`,
      'arc="200 200 150 -60 60" runs over the top of a circle: 0 is the top and degrees go clockwise, as CSS turns.',
    );
  } else {
    out.set("path", arc.d, "arc");
    out.set("absolute", true, "arc");
    out.set(
      "horizontal",
      {
        kind: "MIN",
        offset: arc.x,
      },
      "arc",
    );
    out.set(
      "vertical",
      {
        kind: "MIN",
        offset: arc.y,
      },
      "arc",
    );
  }
}

function arcOf(value: string): ReturnType<typeof arcPath> {
  const parts = value.trim().split(/\s+/);
  const [cx, cy, r] = parts.slice(0, 3).map(pixelLengthOf);
  const [from, to] = parts.slice(3).map((part) => numberOf(part) ?? degreesOf(part));

  if (
    parts.length !== 5 ||
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof r !== "number" ||
    typeof from !== "number" ||
    typeof to !== "number"
  ) {
    return null;
  }

  return arcPath(cx, cy, r, [from, to]);
}

function startRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("start") ?? "";
  const start = startOf(value);

  if (start === null) {
    out.fail(
      "start",
      `start="${value}" is not a segment of the path and a place along it, like "0 0.5".`,
      "Segments count from 0 along the path; the place goes from 0 at the segment's start to 1 at its end.",
    );
  } else {
    out.set("pathStart", start, "start");
  }
}

/**
 * Figma aligns a text on a path at its start (left begins there, center centres on it, right ends there) and draws no
 * letter before the path's beginning, so a centred text from "0 0" shows one: text-align center or right with no start
 * puts the start in the path's middle or at its end.
 */
function alignedStartRule(input: WriteInput, out: WriteOutput): void {
  const share = ALIGN_SHARE[input.own("text-align") ?? ""];

  if (share === undefined || input.tag !== "TextPath" || input.own("start") !== undefined) {
    return;
  }

  const path = pathOf(input);
  const start = path === null ? null : startAlong(path, share);

  if (start !== null) {
    out.set("pathStart", start, "text-align");
  }
}

/** The path a new TextPath is made along (its d or arc), or the one an existing one has. */
function pathOf({ own, merged, existing }: WriteInput): string | null {
  const arc = own("arc");
  const d = existing ? merged("d") : own("d");

  if (!existing && arc !== undefined) {
    return arcOf(arc)?.d ?? null;
  }

  return d === undefined ? null : figmaPath(d);
}

function startOf(value: string): NonNullable<FigmaProps["pathStart"]> | null {
  const parts = value.trim().split(/\s+/);
  const [segment, position] = parts.map(numberOf);

  return parts.length === 2 &&
    segment !== null &&
    segment !== undefined &&
    Number.isInteger(segment) &&
    segment >= 0 &&
    position !== null &&
    position !== undefined &&
    position >= 0 &&
    position <= 1
    ? {
        segment,
        position,
      }
    : null;
}
