import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FIGMA_EFFECT } from "@/core/css/groups/effects/effects.constants.ts";
import type { FieldGroup, NumberField } from "@/core/tokens/bind/bind.types.ts";
import { BIND_KIND } from "@/shared/ops/bind/bind.constants.ts";

/** The Figma variable scopes bound fields take variables of (Figma's VariableScope names). */
export const BIND_SCOPE = {
  frameFill: "FRAME_FILL",
  shapeFill: "SHAPE_FILL",
  textFill: "TEXT_FILL",
  strokeColor: "STROKE_COLOR",
  gap: "GAP",
  cornerRadius: "CORNER_RADIUS",
  strokeFloat: "STROKE_FLOAT",
  opacity: "OPACITY",
} as const;

/** When a number field is one the layer's layout uses (K-027): a gap in a flow that spaces, padding around auto layout. */
export const FIELD_RULE = { flow: "flow", wrap: "wrap", grid: "grid", layout: "layout", always: "always" } as const;

/** Figma's layout values the rules read. */
export const BIND_LAYOUT = {
  none: "NONE",
  horizontal: "HORIZONTAL",
  vertical: "VERTICAL",
  grid: "GRID",
  wrap: "WRAP",
  spaceBetween: "SPACE_BETWEEN",
} as const;

/** Where a value is, by its CSS name (K-028): what results name a field by. */
export const BIND_FIELD = {
  background: CSS_PROPERTY.background,
  border: CSS_PROPERTY.border,
  color: CSS_PROPERTY.color,
  borderWidth: "border-width",
  font: CSS_PROPERTY.font,
  effects: "effects",
} as const;

/** The single number fields bound to variables (K-027), in the order a layer is read, by Figma's names. */
export const NUMBER_FIELDS: Readonly<Record<string, NumberField>> = {
  itemSpacing: { css: CSS_PROPERTY.gap, scope: BIND_SCOPE.gap, rule: FIELD_RULE.flow },
  counterAxisSpacing: { css: CSS_PROPERTY.rowGap, scope: BIND_SCOPE.gap, rule: FIELD_RULE.wrap },
  gridRowGap: { css: CSS_PROPERTY.rowGap, scope: BIND_SCOPE.gap, rule: FIELD_RULE.grid },
  gridColumnGap: { css: CSS_PROPERTY.columnGap, scope: BIND_SCOPE.gap, rule: FIELD_RULE.grid },
  paddingTop: { css: CSS_PROPERTY.padding, scope: BIND_SCOPE.gap, rule: FIELD_RULE.layout },
  paddingRight: { css: CSS_PROPERTY.padding, scope: BIND_SCOPE.gap, rule: FIELD_RULE.layout },
  paddingBottom: { css: CSS_PROPERTY.padding, scope: BIND_SCOPE.gap, rule: FIELD_RULE.layout },
  paddingLeft: { css: CSS_PROPERTY.padding, scope: BIND_SCOPE.gap, rule: FIELD_RULE.layout },
  opacity: { css: CSS_PROPERTY.opacity, scope: BIND_SCOPE.opacity, rule: FIELD_RULE.always },
};

/**
 * Fields of one value bound as one when they agree (K-027): all four corners, as Figma's own picker binds a radius,
 * and all four sides of a border, only where the layer draws a stroke; a layer with no four has the one field.
 */
export const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    fields: ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"],
    single: "cornerRadius",
    css: CSS_PROPERTY.borderRadius,
    scope: BIND_SCOPE.cornerRadius,
    stroked: false,
  },
  {
    fields: ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"],
    single: "strokeWeight",
    css: BIND_FIELD.borderWidth,
    scope: BIND_SCOPE.strokeFloat,
    stroked: true,
  },
];

/** The layer types whose fills Figma scopes as a frame's (K-027); a text's are TEXT_FILL, the rest a shape's. */
export const FRAME_FILL_TYPES: readonly string[] = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"];

/** The effects a box-shadow lists; a blur is BLURS'; any other (noise, texture, glass) matches no style (K-028). */
export const SHADOW_TYPES: readonly string[] = [FIGMA_EFFECT.dropShadow, FIGMA_EFFECT.innerShadow];

/** Raw values as Figma keeps them that bind reads. */
export const BIND_VALUE = {
  alias: "VARIABLE_ALIAS",
  textLayer: "TEXT",
  pixels: "PIXELS",
  originalCase: "ORIGINAL",
  noDecoration: "NONE",
  keyJoint: "|",
} as const;

/** Figma's style types. */
export const STYLE_TYPE = { paint: "PAINT", text: "TEXT", effect: "EFFECT" } as const;

/** What becomes of a raw value: bound, left for a pick, unmatched, or a pick refused. */
export const BIND_DECISION = {
  bound: "bound",
  ambiguous: "ambiguous",
  unmatched: "unmatched",
  refused: "refused",
} as const;

export const BIND_NUMBER = {
  /** An OPACITY variable holds a percent: 50 makes a layer 0.5 opaque, 0.5 makes it 0.005 (FX-049, live 2026-10-17). */
  percent: 100,
  /** Aliases followed at most this deep, 0.7.0's: a loop ends there. */
  aliasDepth: 8,
  /** Groups each list keeps, 0.7.0's: most used first. */
  maxGroups: 200,
  /** Layers each group names, 0.7.0's. */
  examples: 3,
  /** Errors a call reports, 0.7.0's: one wrong pick repeats on every layer with the value. */
  maxErrors: 100,
} as const;

/** The tokens each kind of value takes, as a refused pick names them. */
export const KIND_WORDS: Readonly<Record<string, string>> = {
  [BIND_KIND.color]: "colour token: give a colour variable or a paint style",
  [BIND_KIND.number]: "number token: give a number variable",
  [BIND_KIND.text]: "text style",
  [BIND_KIND.effect]: "effect style",
};

/** A style's or variable's kind as a refused remap names it. */
export const TYPE_WORDS: Readonly<Record<string, string>> = {
  COLOR: "colour variable",
  FLOAT: "number variable",
  STRING: "string variable",
  BOOLEAN: "boolean variable",
  PAINT: "paint style",
  TEXT: "text style",
  EFFECT: "effect style",
};

/** A value as a pick may write it: spaces and case aside. */
export const BIND_PATTERN = { space: /\s+/g } as const;

export const BIND_TEXT = {
  key: (type: string, value: string | number) => `${type} ${value}`,
  px: (value: number) => `${value}px`,
  declaration: (property: string, value: string) => `${property}: ${value}`,
  joint: "; ",
  noKind: (token: string, words: string) => `${token} is no ${words}.`,
  several: (token: string, count: number) => `${token} names ${count} tokens of its kind.`,
  paintStyle: (token: string) =>
    `${token} is a paint style, the whole list of a layer's paints: this layer has several.`,
  missing: (token: string) => `${token} names no style or variable here: tokens_read lists them.`,
  both: (token: string) => `${token} names a style and a variable: rebind one of them by its own token.`,
  kinds: (
    from: string,
    fromKind: string,
    to: string,
    toKind: string,
  ) =>
    `${from} is a ${fromKind} and ${to} a ${toKind}: rebind a token to one of its own kind.`,
  instances: (count: number, remaps: boolean) =>
    `${
      count === 1
        ? "1 instance was left alone: bind its main component, and its instances follow"
        : `${count} instances were left alone: bind their main components, and the instances follow`
    }${remaps ? '; instances: "override" rebinds the uses inside them as their overrides.' : "."}`,
  missingFont:
    "Figma lacks a font this text uses, and binding its text style or a run's colour loads its fonts: install the font, or replace it (fonts_check lists what is missing).",
  usedCut:
    "The scan for the library tokens the layers use ran out of time: a library style or variable used only on layers it did not reach was not considered, so a value only it holds is listed with no token. Bind a page or a layer at a time.",
  defaults: (count: number) =>
    count === 1
      ? "1 layer of a slot's default content was left alone: binding it would make the slot the instance's own, so later changes to the component would no longer reach it; bind the component, and the slot follows."
      : `${count} layers of slots' default content were left alone: binding them would make their slots the instances' own, so later changes to the components would no longer reach them; bind the components, and the slots follow.`,
} as const;

/** What tokens_bind's answer says of its fields. */
export const BIND_RESULT_FIELD = {
  field: "Where the value is, by its CSS name: background, border, color, gap, font, effects…",
  examples: "Ids of a few of the layers.",
  snapped: "The value was not the token's: the layers take the token's value (a choice asked for it).",
  unmatched: "Raw values no token holds.",
} as const;
