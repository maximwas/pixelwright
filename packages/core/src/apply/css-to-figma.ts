import { APPEARANCE_RULES } from "../css-mapping/groups/appearance.ts";
import { ELEMENT_RULES, HREF_RULE } from "../css-mapping/groups/element.ts";
import { GEOMETRY_RULES } from "../css-mapping/groups/geometry/geometry.ts";
import { LAYOUT_RULES } from "../css-mapping/groups/layout/layout.ts";
import { BACKGROUND_RULE, TEXT_COLOR_RULE } from "../css-mapping/groups/paint/fills.ts";
import { STROKES_RULE } from "../css-mapping/groups/paint/strokes.ts";
import { keywordRule } from "../css-mapping/keyword-rule.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../css-mapping/property-group.ts";
import { lengthOf, splitTop, tokenOf } from "../css-mapping/values/css-values.ts";
import { fontOf, textLengthOf } from "../css-mapping/values/fonts.ts";
import { Color } from "../kernel/color/color.ts";
import { roundTo } from "../kernel/numbers.ts";
import type {
  ApplyChange,
  ApplyElement,
  ApplyError,
  EffectSpec,
  FigmaProps,
  LayerNow,
  TextLength,
  TextRunSpec,
} from "../types/apply.ts";
import type { XmlChild } from "../types/xml.ts";

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

const RULES: readonly Rule[] = [
  ...ELEMENT_RULES,
  ...LAYOUT_RULES,
  ...GEOMETRY_RULES,
  ...APPEARANCE_RULES,
  BACKGROUND_RULE,
  STROKES_RULE,
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
  TEXT_COLOR_RULE,
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
