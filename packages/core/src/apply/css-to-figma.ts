import { ELEMENT_RULES, HREF_RULE } from "../css-mapping/groups/element.ts";
import { GEOMETRY_RULES } from "../css-mapping/groups/geometry/geometry.ts";
import { LAYOUT_RULES } from "../css-mapping/groups/layout/layout.ts";
import { keywordRule } from "../css-mapping/keyword-rule.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../css-mapping/property-group.ts";
import { boxOf, imageOf, lengthOf, numberOf, percentOf, splitTop, tokenOf } from "../css-mapping/values/css-values.ts";
import { fontOf, textLengthOf } from "../css-mapping/values/fonts.ts";
import { paintOf } from "../css-mapping/values/paints.ts";
import { Color } from "../kernel/color/color.ts";
import { roundTo } from "../kernel/numbers.ts";
import type {
  ApplyChange,
  ApplyElement,
  ApplyError,
  EffectSpec,
  FigmaProps,
  LayerNow,
  PaintSpec,
  TextLength,
  TextRunSpec,
} from "../types/apply.ts";
import type { XmlChild } from "../types/xml.ts";

interface Side {
  readonly weight: number;
  readonly dash: boolean;
  readonly paint: PaintSpec;
}

const SIDES = ["top", "right", "bottom", "left"] as const;
const STROKES = ["border", "border-top", "border-right", "border-bottom", "border-left", "outline"];
const EFFECTS = ["box-shadow", "text-shadow", "filter", "backdrop-filter"];
const DECORATION = ["text-decoration", "text-underline-offset", "text-decoration-thickness"];

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

const RULES: readonly Rule[] = [
  ...ELEMENT_RULES,
  ...LAYOUT_RULES,
  ...GEOMETRY_RULES,
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
      [HREF_RULE, ...TEXT_RULES],
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
