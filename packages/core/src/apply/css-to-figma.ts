import { LAYOUT_TAGS } from "../constants/apply.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../css-mapping/property-group.ts";
import { imageOf, lengthOf, numberOf, percentOf, splitTop, tokenOf } from "../css-mapping/values/css-values.ts";
import { fontOf, textLengthOf } from "../css-mapping/values/fonts.ts";
import { paintOf } from "../css-mapping/values/paints.ts";
import { Color } from "../kernel/color/color.ts";
import { roundTo } from "../kernel/numbers.ts";
import type {
  ApplyChange,
  ApplyElement,
  ApplyError,
  AxisPlacement,
  EffectSpec,
  FigmaProps,
  GridTrack,
  LayerNow,
  LengthValue,
  PaintSpec,
  SelfAlign,
  TextLength,
  TextRunSpec,
} from "../types/apply.ts";
import type { XmlChild } from "../types/xml.ts";

interface Axis {
  readonly start: "left" | "top";
  readonly end: "right" | "bottom";
  readonly size: "width" | "height";
  readonly key: "horizontal" | "vertical";
}

interface Side {
  readonly weight: number;
  readonly dash: boolean;
  readonly paint: PaintSpec;
}

const LAYOUT = [
  "display",
  "flex-direction",
  "flex-wrap",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
];
const SIDES = ["top", "right", "bottom", "left"] as const;
const STROKES = ["border", "border-top", "border-right", "border-bottom", "border-left", "outline"];
const EFFECTS = ["box-shadow", "text-shadow", "filter", "backdrop-filter"];
const DECORATION = ["text-decoration", "text-underline-offset", "text-decoration-thickness"];

const DISPLAYS: Readonly<Record<string, "flex" | "grid" | "block" | "none">> = {
  flex: "flex",
  "inline-flex": "flex",
  grid: "grid",
  "inline-grid": "grid",
  block: "block",
  "inline-block": "block",
  none: "none",
};

const JUSTIFY: Readonly<Record<string, Exclude<FigmaProps["primaryAxisAlignItems"], undefined>>> = {
  normal: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  "space-between": "SPACE_BETWEEN",
  "space-evenly": "SPACE_EVENLY",
  "space-around": "SPACE_AROUND",
};

const ALIGN: Readonly<Record<string, Exclude<FigmaProps["counterAxisAlignItems"], undefined>>> = {
  normal: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  baseline: "BASELINE",
};

const ALIGN_CONTENT: Readonly<Record<string, Exclude<FigmaProps["counterAxisAlignContent"], undefined>>> = {
  normal: "AUTO",
  "flex-start": "AUTO",
  start: "AUTO",
  "space-between": "SPACE_BETWEEN",
};

const SELF: Readonly<Record<string, SelfAlign>> = {
  auto: "AUTO",
  normal: "AUTO",
  start: "MIN",
  "flex-start": "MIN",
  "self-start": "MIN",
  center: "CENTER",
  end: "MAX",
  "flex-end": "MAX",
  "self-end": "MAX",
  stretch: "STRETCH",
};

const CASES: Readonly<Record<string, Exclude<FigmaProps["textCase"], undefined>>> = {
  none: "ORIGINAL",
  uppercase: "UPPER",
  lowercase: "LOWER",
  capitalize: "TITLE",
};

const TEXT_ALIGNS: Readonly<Record<string, Exclude<FigmaProps["textAlignHorizontal"], undefined>>> = {
  left: "LEFT",
  start: "LEFT",
  center: "CENTER",
  right: "RIGHT",
  end: "RIGHT",
  justify: "JUSTIFIED",
};

const TEXT_WRAPS: Readonly<Record<string, Exclude<FigmaProps["textWrapStyle"], undefined>>> = {
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

const BORDER_STYLES = new Set(["solid", "dashed", "dotted", "none", "hidden"]);

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

const HREF: Rule = {
  attributes: ["href"],
  write: ({ own }, out) => out.set("hyperlink", own("href") ?? "", "href"),
};

const RULES: readonly Rule[] = [
  {
    attributes: ["name"],
    write: ({ own }, out) => out.set("name", own("name") ?? "", "name"),
  },
  HREF,
  {
    attributes: ["component"],
    write: ({ own }, out) => out.set("component", own("component") ?? "", "component"),
  },
  {
    attributes: ["variant"],
    write: listRule("variant"),
  },
  {
    attributes: ["props"],
    write: listRule("props"),
  },
  {
    attributes: ["description"],
    write: ({ own }, out) => out.set("description", own("description") ?? "", "description"),
  },
  {
    attributes: ["note"],
    write: ({ own }, out) => out.set("notes", notesOf(own("note") ?? ""), "note"),
  },
  {
    attributes: ["prop", "visibleProp"],
    write: ({ own }, out) => {
      const text = own("prop");
      const visible = own("visibleProp");

      out.set(
        "property",
        {
          ...(text === undefined ? {} : { text }),
          ...(visible === undefined ? {} : { visible }),
        },
        text === undefined ? "visibleProp" : "prop",
      );
    },
  },
  {
    attributes: ["src"],
    write: ({ tag, own }, out) => {
      if (tag === "Image" || tag === "Icon") {
        out.set(
          "asset",
          {
            kind: tag === "Image" ? "image" : "icon",
            src: own("src") ?? "",
          },
          "src",
        );
      } else {
        out.fail(
          "src",
          `src makes an <Image> or an <Icon>, not a <${tag}>.`,
          "A frame's image is its background: url(…).",
        );
      }
    },
  },
  {
    attributes: LAYOUT,
    write: layoutRule,
  },
  {
    attributes: ["padding"],
    write: paddingRule,
  },
  {
    attributes: ["justify-content"],
    write: keywordRule("justify-content", JUSTIFY, "primaryAxisAlignItems"),
  },
  {
    attributes: ["align-items"],
    write: keywordRule("align-items", ALIGN, "counterAxisAlignItems"),
  },
  {
    attributes: ["align-content"],
    write: keywordRule("align-content", ALIGN_CONTENT, "counterAxisAlignContent"),
  },
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
  ...(
    [
      ["min-width", "minWidth"],
      ["max-width", "maxWidth"],
      ["min-height", "minHeight"],
      ["max-height", "maxHeight"],
    ] as const
  ).map(
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
    write: keywordRule("align-self", SELF, "alignSelf"),
  },
  {
    attributes: ["justify-self"],
    write: keywordRule("justify-self", SELF, "justifySelf"),
  },
  {
    attributes: ["grid-row"],
    write: spanRule("grid-row", "gridRow"),
  },
  {
    attributes: ["grid-column"],
    write: spanRule("grid-column", "gridColumn"),
  },
  {
    attributes: ["transform"],
    write: transformRule,
  },
  {
    attributes: ["opacity"],
    write: opacityRule,
  },
  {
    attributes: ["overflow", "text-overflow", "white-space"],
    write: overflowRule,
  },
  {
    attributes: ["border-radius"],
    write: radiusRule,
  },
  {
    attributes: ["background"],
    write: paintRule("background", "fills"),
  },
  {
    attributes: STROKES,
    write: strokesRule,
  },
  {
    attributes: EFFECTS,
    write: effectsRule,
  },
];

/** What a Text and its spans set; those a text style covers are written again when the style changes. */
const TEXT_RULES: readonly Rule[] = [
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
    write: keywordRule("text-transform", CASES, "textCase"),
  },
  {
    attributes: DECORATION,
    styled: true,
    write: decorationRule,
  },
  {
    attributes: ["text-align"],
    write: keywordRule("text-align", TEXT_ALIGNS, "textAlignHorizontal"),
  },
  {
    attributes: ["text-wrap"],
    write: keywordRule("text-wrap", TEXT_WRAPS, "textWrapStyle"),
  },
  {
    attributes: ["color"],
    write: paintRule("color", "textFills"),
  },
];

/**
 * An element as a change in Figma's terms, through the mapping table backwards. With `now` (unchangedAttributes), only
 * what the layer does not have yet is written, and what Figma keeps in one property is completed from what the layer
 * has: a new gap keeps the direction, a blur keeps the shadows. An attribute the element leaves out stays as it is. A
 * value that cannot be written is an error on its attribute; the rest of the element still applies.
 */
export function changeOf(element: ApplyElement, now?: LayerNow): { change: ApplyChange; errors: ApplyError[] } {
  const errors: ApplyError[] = [];
  const props: FigmaProps = {};
  const sources: Partial<Record<keyof FigmaProps, string>> = {};
  const attributes = element.attributes;
  const current = now?.current ?? {};
  const changed = (name: string) =>
    name !== "id" && attributes[name] !== undefined && !(now?.attributes.has(name) ?? false);
  const input: WriteInput = {
    tag: element.tag,
    own: (name) => attributes[name],
    merged: (name) => attributes[name] ?? current[name],
    changed,
    hidden: now !== undefined && !now.visible,
  };
  const out = output(element, element.id, props, sources, errors);
  // Applying a text style resets what it covers: the element's own overrides and its runs are written again.
  const restyled = element.tag === "Text" && changed("textStyle");

  translate(RULES, input, out, false);
  translate(TEXT_RULES, input, out, restyled);

  const text =
    element.content !== undefined && (!(now?.text ?? false) || restyled)
      ? textOf(element.content, input.merged, element.id, errors)
      : undefined;
  const order = Object.keys(attributes);
  const rank = (error: ApplyError) => {
    const index = error.attribute === undefined ? -1 : order.indexOf(error.attribute);

    return index === -1 ? order.length : index;
  };

  return {
    change: {
      line: element.line,
      column: element.column,
      kind: element.id === null && element.source === undefined ? "create" : "update",
      ref: element.ref,
      id: element.id,
      tag: element.tag,
      parent: element.parent,
      index: element.index,
      ...(attributes.before === undefined ? {} : { before: attributes.before }),
      ...(attributes.after === undefined ? {} : { after: attributes.after }),
      props,
      sources,
      ...(text === undefined ? {} : { text }),
      ...(attributes.copyOf === undefined ? {} : { copyOf: attributes.copyOf }),
      ...(element.source === undefined ? {} : { source: element.source }),
      ...(element.copy === undefined ? {} : { copy: element.copy }),
    },
    errors: errors.toSorted((a, b) => rank(a) - rank(b)),
  };
}

function translate(rules: readonly Rule[], input: WriteInput, out: WriteOutput, restyled: boolean): void {
  for (const rule of rules) {
    const forced = restyled && rule.styled && rule.attributes.some((name) => input.own(name) !== undefined);

    if (forced || rule.attributes.some(input.changed)) {
      rule.write(
        forced
          ? {
              ...input,
              merged: input.own,
            }
          : input,
        out,
      );
    }
  }
}

function output(
  location: { readonly line: number; readonly column: number },
  id: string | null,
  props: FigmaProps,
  sources: Partial<Record<keyof FigmaProps, string>>,
  errors: ApplyError[],
): WriteOutput {
  return {
    set(key, value, attribute) {
      (props as Record<string, unknown>)[key] = value;
      sources[key] = attribute;
    },
    fail(attribute, message, hint) {
      errors.push({
        line: location.line,
        column: location.column,
        ...(id === null ? {} : { id }),
        attribute,
        message,
        ...(hint === undefined ? {} : { hint }),
      });
    },
  };
}

function keywordRule<K extends keyof FigmaProps>(
  attribute: string,
  table: Readonly<Record<string, Exclude<FigmaProps[K], undefined>>>,
  key: K,
): Rule["write"] {
  return ({ own }, out) => {
    const value = own(attribute) ?? "";
    const mapped = table[value];

    if (mapped === undefined) {
      out.fail(attribute, `${attribute}="${value}" is not one Figma has: ${Object.keys(table).join(", ")}.`);
    } else {
      out.set(key, mapped, attribute);
    }
  };
}

/** Auto layout: the direction, wrap and gaps, read together since a gap means another axis in another direction. */
function layoutRule(input: WriteInput, out: WriteOutput): void {
  const { merged, changed } = input;
  const display = merged("display");
  const mode = display === undefined ? "block" : DISPLAYS[display];

  if (mode === undefined) {
    out.fail(
      "display",
      `display="${display}" is not one Figma has: flex, grid, block (no auto layout) or none (hidden).`,
    );

    return;
  }

  if (mode === "none") {
    // Hidden: the layout it has stays for when it is shown again.
    out.set("visible", false, "display");

    return;
  }

  if (changed("display") && input.hidden) {
    out.set("visible", true, "display");
  }

  if (mode === "grid") {
    gridLayout(input, out);
  } else if (mode === "flex") {
    flexLayout(input, out);
  } else {
    if (display !== undefined && LAYOUT_TAGS.has(input.tag)) {
      out.set("layoutMode", "NONE", "display");
    }

    for (const name of LAYOUT.slice(1).filter(changed)) {
      out.fail(name, `${name} needs display="flex" or display="grid": without auto layout it spaces nothing.`);
    }
  }
}

function flexLayout(input: WriteInput, out: WriteOutput): void {
  const { merged, changed } = input;

  const direction = merged("flex-direction") ?? "row";

  if (direction !== "row" && direction !== "column") {
    out.fail(
      "flex-direction",
      `flex-direction="${direction}" is not one Figma has: row or column (auto layout has no reverse order).`,
    );

    return;
  }

  const vertical = direction === "column";
  const wrap = merged("flex-wrap");

  out.set(
    "layoutMode",
    vertical ? "VERTICAL" : "HORIZONTAL",
    merged("flex-direction") === undefined ? "display" : "flex-direction",
  );

  if (wrap !== undefined) {
    if (wrap === "wrap" || wrap === "nowrap") {
      out.set("layoutWrap", wrap === "wrap" ? "WRAP" : "NO_WRAP", "flex-wrap");
    } else {
      out.fail("flex-wrap", `flex-wrap="${wrap}" is not one Figma has: wrap or nowrap.`);
    }
  }

  // As in CSS: along a row the columns are spaced, along a column the rows; the other gap is between wrapped lines.
  const { row, column } = gapsOf(input, out);
  const along = vertical ? row : column;
  const across = vertical ? column : row;

  if (along !== undefined) {
    out.set("itemSpacing", along.value, along.attribute);
  }

  if (across !== undefined && wrap === "wrap") {
    out.set("counterAxisSpacing", across.value, across.attribute);
  }

  for (const name of ["grid-template-columns", "grid-template-rows"].filter(changed)) {
    out.fail(name, `${name} needs display="grid".`);
  }
}

function gridLayout(input: WriteInput, out: WriteOutput): void {
  const { merged, changed } = input;

  out.set("layoutMode", "GRID", "display");

  for (const [attribute, key] of [
    ["grid-template-columns", "gridColumns"],
    ["grid-template-rows", "gridRows"],
  ] as const) {
    const value = merged(attribute);
    const tracks = value === undefined ? undefined : tracksOf(value);

    if (tracks === null) {
      out.fail(attribute, `${attribute}="${value}" is not tracks in fr, px or auto (repeat() allowed).`);
    } else if (tracks !== undefined) {
      out.set(key, tracks, attribute);
    }
  }

  const { row, column } = gapsOf(input, out);

  if (column !== undefined) {
    out.set("gridColumnGap", column.value, column.attribute);
  }

  if (row !== undefined) {
    out.set("gridRowGap", row.value, row.attribute);
  }

  for (const name of ["flex-direction", "flex-wrap"].filter(changed)) {
    out.fail(name, `${name} needs display="flex": a grid places its children in tracks.`);
  }
}

/** The row and column gaps: `gap` gives both (or row then column), row-gap and column-gap one each. */
function gapsOf(
  { own, merged }: Pick<WriteInput, "own" | "merged">,
  out: WriteOutput,
): { row?: { value: LengthValue; attribute: string }; column?: { value: LengthValue; attribute: string } } {
  // A gap the element gives resets the row and column gaps the layer has, as the CSS shorthand does.
  const shorthand = own("gap") !== undefined;
  const gap = merged("gap");
  let parts = gap === undefined ? [] : splitTop(gap, " ").map(lengthOf);

  if (gap !== undefined && (parts.length === 0 || parts.length > 2 || parts.includes(null))) {
    out.fail("gap", `gap="${gap}" is not one or two lengths in px or tokens (rows, then columns).`);
    parts = [];
  }

  const result: {
    row?: { value: LengthValue; attribute: string };
    column?: { value: LengthValue; attribute: string };
  } = {};

  for (const [axis, attribute, part] of [
    ["row", "row-gap", parts[0]],
    ["column", "column-gap", parts[1] ?? parts[0]],
  ] as const) {
    const value = shorthand ? own(attribute) : merged(attribute);

    if (value === undefined) {
      if (part !== undefined && part !== null) {
        result[axis] = {
          value: part,
          attribute: "gap",
        };
      }

      continue;
    }

    const length = value === "normal" ? 0 : lengthOf(value);

    if (length === null) {
      out.fail(attribute, `${attribute}="${value}" is not a length in px or a token.`);
    } else {
      result[axis] = {
        value: length,
        attribute,
      };
    }
  }

  return result;
}

function paddingRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("padding") ?? "";
  const sides = boxOf(splitTop(value, " ").map(lengthOf));

  if (sides === null) {
    out.fail("padding", `padding="${value}" is not 1 to 4 lengths in px or tokens.`);
  } else {
    out.set("padding", sides, "padding");
  }
}

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
 * unpins the left one; a new size alone keeps the edge the layer is pinned to.
 */
function axisRule({ start, end, size, key }: Axis): Rule["write"] {
  return ({ own, merged, changed }, out) => {
    const ownEdges = own(start) !== undefined || own(end) !== undefined;
    const edge = (name: string) => {
      const value = ownEdges ? own(name) : merged(name);

      return value === "auto" ? undefined : value;
    };
    const from = edge(start);
    const to = edge(end);
    let placed: AxisPlacement | null = null;

    if (from !== undefined || to !== undefined) {
      if (merged("position") === "absolute") {
        const result = placementOf(start, end, from, to, merged(size));

        if ("error" in result) {
          out.fail(result.attribute, result.error);
        } else {
          placed = result.placement;
          out.set(key, placed, from === undefined ? end : start);
        }
      } else {
        for (const name of [start, end].filter((name) => changed(name) && own(name) !== "auto")) {
          out.fail(
            name,
            `${name} places a layer with position="absolute"; this one flows in its parent.`,
            `Add position="absolute", or leave ${name} out.`,
          );
        }
      }
    }

    if (!changed(size) || placed?.kind === "SCALE") {
      // A scaled layer's size is its placement's percent.
      return;
    }

    const value = own(size) ?? "";

    if (placed?.kind === "STRETCH") {
      out.fail(
        size,
        `${size} comes from ${start} and ${end} when both are set: set one of them to auto to size the layer.`,
      );
    } else if (value === "auto" || value === "fit-content" || value === "max-content") {
      out.set(size, "HUG", size);
    } else {
      const length = lengthOf(value);

      if (length === null) {
        out.fail(
          size,
          `${size}="${value}" is not a length in px, a token or auto.`,
          percentOf(value) === null
            ? undefined
            : `A percent scales with the parent: it needs ${start} in percents too.`,
        );
      } else {
        out.set(size, length, size);
      }
    }
  };
}

function placementOf(
  start: string,
  end: string,
  from: string | undefined,
  to: string | undefined,
  size: string | undefined,
): { placement: AxisPlacement } | { attribute: string; error: string } {
  if (from !== undefined) {
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

    if (percent !== null) {
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
  }

  const pixels = (value: string | undefined) => {
    const length = value === undefined ? undefined : lengthOf(value);

    return typeof length === "object" ? null : length;
  };
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

function limitRule(attribute: string, key: "minWidth" | "maxWidth" | "minHeight" | "maxHeight"): Rule["write"] {
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

function spanRule(attribute: string, key: "gridRow" | "gridColumn"): Rule["write"] {
  return ({ own }, out) => {
    const value = (own(attribute) ?? "").trim();
    const match = /^(\d+)(?:\s*\/\s*(?:span\s+(\d+)|(\d+)))?$/.exec(value);
    const first = Number(match?.[1]);
    const span = match?.[2] !== undefined ? Number(match[2]) : match?.[3] !== undefined ? Number(match[3]) - first : 1;

    if (match === null || first < 1 || span < 1) {
      out.fail(attribute, `${attribute}="${value}" is not "N", "N / span M" or "N / M", lines counted from 1.`);
    } else {
      out.set(
        key,
        {
          anchor: first - 1,
          span,
        },
        attribute,
      );
    }
  };
}

/** The whole transform: a turn without scaleX(-1) also takes a mirror away. */
function transformRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("transform") ?? "";
  let rotation = 0;
  let mirror = false;

  for (const part of value === "none" ? [] : splitTop(value, " ")) {
    const turn = /^rotate\(\s*(-?\d*\.?\d+)deg\s*\)$/.exec(part);

    if (turn !== null) {
      // CSS turns clockwise, Figma counter-clockwise.
      rotation = roundTo(-Number(turn[1]), 4);
    } else if (part === "scaleX(-1)") {
      mirror = true;
    } else {
      out.fail("transform", `transform part ${part} is not rotate(Ndeg) or scaleX(-1), which is all Figma keeps.`);

      return;
    }
  }

  out.set("rotation", rotation, "transform");
  out.set("mirror", mirror, "transform");
}

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

  const corners = value.includes("/") ? null : boxOf(splitTop(value, " ").map(lengthOf));

  if (corners === null) {
    out.fail("border-radius", `border-radius="${value}" is not 1 to 4 lengths in px or tokens.`);
  } else {
    out.set("cornerRadius", corners.every((corner) => corner === corners[0]) ? corners[0] : corners, "border-radius");
  }
}

function paintRule(attribute: "background" | "color", key: "fills" | "textFills"): Rule["write"] {
  return ({ own }, out) => {
    const layers = layersOf(attribute, own(attribute) ?? "", out);

    if (layers !== null) {
      out.set(key, layers, attribute);
    }
  };
}

/** Paint layers, top first in CSS and bottom first in Figma; a flat gradient is a colour layer. */
function layersOf(attribute: string, value: string, out: WriteOutput): PaintSpec[] | null {
  if (value === "none" || value === "transparent") {
    return [];
  }

  const layers: PaintSpec[] = [];

  for (const layer of splitTop(value, ",")) {
    const stops = /^linear-gradient\((.+)\)$/s.exec(layer)?.[1];
    const flat = stops === undefined ? null : splitTop(stops, ",");
    const paint = flat !== null && flat.length === 2 && flat[0] === flat[1] ? paintOf(flat[0] ?? "") : paintOf(layer);

    const image = paint === null ? imageOf(layer) : null;

    if (paint !== null) {
      layers.push(paint);
    } else if (image === "unquoted") {
      out.fail(
        attribute,
        `${layer.slice(0, 40)}: url() without quotes cannot hold spaces, quotes, brackets or var().`,
        'Write the file in quotes: url("my photo.png").',
      );

      return null;
    } else if (image !== null && attribute === "background") {
      // design_read's fits: cover is FILL, contain FIT, a repeat TILE.
      const fit = image.rest;

      layers.push({
        kind: "image",
        src: image.src,
        scaleMode: fit.includes("contain") ? "FIT" : /(^|\s)repeat(\s|$)/.test(fit) ? "TILE" : "FILL",
      });
    } else if (image !== null) {
      out.fail(attribute, "A text is coloured with paint, not an image.", "Use a colour or a token.");

      return null;
    } else if (layer.includes("gradient(")) {
      out.fail(attribute, `${layer.slice(0, 40)}…: a gradient is not written yet.`, "Use a colour or a token.");

      return null;
    } else {
      out.fail(
        attribute,
        `${attribute}="${value}" is not a colour, a token or color-mix(in srgb, var(--x) N%, transparent) (in display-p3 in a Display P3 file).`,
      );

      return null;
    }
  }

  return layers.toReversed();
}

/**
 * Figma strokes a layer once, every side in one colour and style. A border or outline in the element resets every
 * side, as the CSS shorthands do; a side alone changes only itself, the others kept from what the layer has.
 */
function strokesRule({ own, merged }: WriteInput, out: WriteOutput): void {
  const read = own("border") !== undefined || own("outline") !== undefined ? own : merged;
  const border = read("border");
  const outline = read("outline");
  const source = STROKES.find((name) => own(name) !== undefined) ?? "border";

  if (border !== undefined && outline !== undefined && border !== "none" && outline !== "none") {
    out.fail("outline", "Figma strokes a layer once: write border (inside) or outline (outside), not both.");

    return;
  }

  const outside = outline !== undefined && outline !== "none";
  const all = outside ? sideOf("outline", outline, out) : border === undefined ? null : sideOf("border", border, out);
  const sides = SIDES.map((side) => {
    const value = read(`border-${side}`);

    return value === undefined ? all : sideOf(`border-${side}`, value, out);
  });

  if (all === INVALID || sides.includes(INVALID)) {
    return;
  }

  const drawn = sides.filter((side): side is Side => side !== null && side !== INVALID);
  const [first] = drawn;
  const align = outside ? "OUTSIDE" : "INSIDE";

  if (first === undefined) {
    out.set(
      "strokes",
      {
        paints: [],
        align,
        dash: false,
      },
      source,
    );

    return;
  }

  if (drawn.some((side) => side.dash !== first.dash || JSON.stringify(side.paint) !== JSON.stringify(first.paint))) {
    out.fail(
      STROKES.find((name) => name.startsWith("border-") && own(name) !== undefined) ?? source,
      "Figma draws every side of a stroke in one colour and style: give the sides the same ones.",
    );

    return;
  }

  const [top = 0, right = 0, bottom = 0, left = 0] = sides.map((side) => (side === null ? 0 : (side as Side).weight));

  out.set(
    "strokes",
    {
      paints: [first.paint],
      ...(top === right && right === bottom && bottom === left
        ? { weight: top }
        : {
            sides: {
              top,
              right,
              bottom,
              left,
            },
          }),
      align,
      dash: first.dash,
    },
    source,
  );
}

/** A side that could not be read: its error is out already. */
const INVALID = Symbol("invalid");

/** One side of a border, in any order CSS allows: `1px solid #000`; null when none is drawn. */
function sideOf(attribute: string, value: string, out: WriteOutput): Side | null | typeof INVALID {
  if (value === "none" || value === "0") {
    return null;
  }

  const words = splitTop(value, " ");
  const width = words.find((word) => typeof lengthOf(word) === "number");
  const style = words.find((word) => BORDER_STYLES.has(word));
  const paint = paintOf(words.filter((word) => word !== width && word !== style).join(" "));

  if (style === "none" || style === "hidden" || lengthOf(width ?? "") === 0) {
    return null;
  }

  if (width === undefined || style === undefined || paint === null) {
    out.fail(attribute, `${attribute}="${value}" is not "Npx solid|dashed <colour or token>".`);

    return INVALID;
  }

  return {
    weight: lengthOf(width) as number,
    dash: style !== "solid",
    paint,
  };
}

/** Shadows and blurs are one list in Figma: an attribute the element leaves out keeps what the layer has. */
function effectsRule({ own, merged, changed }: WriteInput, out: WriteOutput): void {
  const shadowAttribute = merged("box-shadow") === undefined ? "text-shadow" : "box-shadow";
  const shadows = merged(shadowAttribute);
  const token = shadows === undefined ? null : tokenOf(shadows);
  const source = EFFECTS.find(changed) ?? shadowAttribute;

  if (token !== null) {
    for (const name of ["filter", "backdrop-filter"].filter((name) => changed(name) && own(name) !== "none")) {
      out.fail(name, `The effect style ${token.token} holds every effect: change the style, or write its shadows out.`);
    }

    out.set("effects", token, shadowAttribute);

    return;
  }

  const effects: EffectSpec[] = [];

  for (const [attribute, type] of [
    ["filter", "LAYER_BLUR"],
    ["backdrop-filter", "BACKGROUND_BLUR"],
  ] as const) {
    const value = merged(attribute);

    if (value !== undefined && value !== "none") {
      const blur = /^blur\(\s*(\d*\.?\d+)px\s*\)$/.exec(value);

      if (blur === null) {
        out.fail(attribute, `${attribute}="${value}" is not blur(Npx), the one filter Figma has.`);

        return;
      }

      // Figma's blur radius is twice CSS's.
      effects.push({
        type,
        radius: roundTo(Number(blur[1]) * 2, 4),
      });
    }
  }

  const list: EffectSpec[] = [];

  for (const shadow of shadows === undefined || shadows === "none" ? [] : splitTop(shadows, ",")) {
    const words = splitTop(shadow, " ");
    const lengths = words.map(lengthOf).filter((length): length is number => typeof length === "number");
    const color =
      Color.parse(words.filter((word) => word !== "inset" && typeof lengthOf(word) !== "number").join(" "))?.value() ??
      null;

    if (lengths.length < 2 || lengths.length > 4 || color === null) {
      out.fail(shadowAttribute, `"${shadow}" is not a shadow: [inset] x y [blur] [spread] and a colour.`);

      return;
    }

    const [x = 0, y = 0, radius = 0, spread = 0] = lengths;

    list.push({
      type: words.includes("inset") ? "INNER_SHADOW" : "DROP_SHADOW",
      color,
      x,
      y,
      radius,
      spread,
    });
  }

  out.set("effects", [...effects, ...list.toReversed()], source);
}

function fontRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("font") ?? "";
  const font = fontOf(value);

  if (font === null) {
    out.fail("font", `font="${value}" is not "[italic] weight size/line-height 'Family'".`);
  } else {
    out.set("font", font, "font");
  }
}

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
  const color = rest === "" ? null : (Color.parse(rest)?.value() ?? null);
  const source = DECORATION.find(changed) ?? "text-decoration";

  if (value !== undefined && (line === undefined || (rest !== "" && color === null))) {
    out.fail("text-decoration", `text-decoration="${value}" is not "underline|line-through|none [style] [colour]".`);

    return;
  }

  const lengths: { offset?: TextLength; thickness?: TextLength } = {};

  for (const [attribute, key] of [
    ["text-underline-offset", "offset"],
    ["text-decoration-thickness", "thickness"],
  ] as const) {
    const length = merged(attribute);
    const read = length === undefined ? undefined : textLengthOf(length);

    if (read === null) {
      out.fail(attribute, `${attribute}="${length}" is not a length in px or em, or auto.`);

      return;
    }

    if (read !== undefined) {
      lengths[key] = read;
    }
  }

  out.set(
    "textDecoration",
    {
      line: LINES[line ?? "none"] ?? "NONE",
      ...(style === undefined ? {} : { style: DECORATION_STYLES[style] ?? "SOLID" }),
      ...(color === null ? {} : { color }),
      ...lengths,
    },
    source,
  );
}

/** Characters from text and spans, and a run per span with what it sets over the text's own. */
function textOf(
  content: readonly XmlChild[],
  base: AttributeReader,
  id: string | null,
  errors: ApplyError[],
): { characters: string; runs: TextRunSpec[] } {
  let characters = "";
  const runs: TextRunSpec[] = [];

  for (const child of content) {
    if (child.kind === "text") {
      characters += child.value;
      continue;
    }

    const start = characters.length;
    const props: FigmaProps = {};

    characters += textIn(child.children);
    translate(
      [HREF, ...TEXT_RULES],
      {
        tag: "Span",
        own: (name) => child.props[name],
        merged: (name) => child.props[name] ?? base(name),
        changed: (name) => child.props[name] !== undefined,
        hidden: false,
      },
      output(child, id, props, {}, errors),
      false,
    );
    runs.push({
      start,
      end: characters.length,
      props,
    });
  }

  return {
    characters,
    runs,
  };
}

function textIn(children: readonly XmlChild[]): string {
  return children.map((child) => (child.kind === "text" ? child.value : textIn(child.children))).join("");
}

function tracksOf(value: string): GridTrack[] | null {
  const tracks: GridTrack[] = [];

  for (const part of splitTop(value, " ")) {
    const repeat = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/.exec(part);
    const items = repeat === null ? [part] : Array.from({ length: Number(repeat[1]) }, () => (repeat[2] ?? "").trim());

    for (const item of items) {
      const fraction = /^(\d*\.?\d+)fr$/.exec(item);
      const pixels = lengthOf(item);

      if (fraction !== null) {
        tracks.push({
          type: "FLEX",
          value: Number(fraction[1]),
        });
      } else if (item === "auto") {
        tracks.push({ type: "HUG" });
      } else if (typeof pixels === "number") {
        tracks.push({
          type: "FIXED",
          value: pixels,
        });
      } else {
        return null;
      }
    }
  }

  return tracks.length === 0 ? null : tracks;
}

/** A CSS box shorthand of 1 to 4 values, top (or top-left) first and clockwise. */
function boxOf<T>(parts: readonly (T | null)[]): [T, T, T, T] | null {
  if (parts.length === 0 || parts.length > 4 || parts.includes(null)) {
    return null;
  }

  const [a, b = a, c = a, d = b] = parts as T[];

  return [a as T, b as T, c as T, d as T];
}

/** design_read's list `Name=Value, Other=Value`, a comma, equals sign or backslash in it escaped with a backslash. */
function listRule(key: "variant" | "props"): Rule["write"] {
  return ({ own }, out) => {
    const value = own(key) ?? "";
    const items = listOf(value);

    if (items === null) {
      out.fail(
        key,
        `${key}="${value}" is not a list of Name=Value, separated by commas.`,
        "Escape a comma or = in a name or value with a backslash.",
      );
    } else {
      out.set(key, items, key);
    }
  };
}

function listOf(value: string): Record<string, string> | null {
  const items: [string, string][] = [];
  let name: string | null = null;
  let current = "";

  for (let index = 0; index < value.length; index++) {
    const char = value[index] ?? "";

    if (char === "\\" && index + 1 < value.length) {
      index += 1;
      current += value[index] ?? "";
    } else if (char === "=" && name === null) {
      name = current.trim();
      current = "";
    } else if (char === ",") {
      if (name === null) {
        return null;
      }

      items.push([name, current.trim()]);
      name = null;
      current = "";
    } else {
      current += char;
    }
  }

  if (name !== null) {
    items.push([name, current.trim()]);
  } else if (current.trim() !== "") {
    return null;
  }

  return Object.fromEntries(items);
}

/** design_read's notes: `Category: note | Another`, a bar or backslash in a note escaped with a backslash. */
function notesOf(value: string): { category: string | null; label: string }[] {
  const items: string[] = [];
  let current = "";

  for (let index = 0; index < value.length; index++) {
    const char = value[index] ?? "";

    if (char === "\\" && index + 1 < value.length) {
      index += 1;
      current += value[index] ?? "";
    } else if (char === "|") {
      items.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  items.push(current);

  return items
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .map((item) => {
      const at = item.indexOf(": ");

      return at === -1
        ? {
            category: null,
            label: item,
          }
        : {
            category: item.slice(0, at),
            label: item.slice(at + 2),
          };
    });
}
