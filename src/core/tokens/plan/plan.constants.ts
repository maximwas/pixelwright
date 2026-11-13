import { MODEL_VALUE, STYLE_GROUP, type StyleGroup } from "@/core/tokens/model/model.constants.ts";
import { TAG } from "@/core/xml/tags.constants.ts";
import { PLAN_VALUE, WRITABLE_TYPE } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { PlanValue, WritableType } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";
import { INTENT_EFFECT } from "@/shared/write-intents/write-intent.constants.ts";

/** tokens_apply's bounds (K-018), 0.7.0's: a design system's tokens fit, and one call stays a size one plan holds. */
export const TOKENS_APPLY = {
  /** A name: 1 to 512 characters, past any name Figma's panels show. */
  minName: 1,
  maxName: 512,
  /** A CSS value or a description: 10 000 characters hold a long gradient or shadow list. */
  maxValue: 10_000,
  /** A type's name: Figma's longest is BOOLEAN; 32 leaves room for one it adds. */
  maxType: 32,
  maxCollections: 200,
  /** Figma's most modes a collection, on its Enterprise plan. */
  maxModes: 40,
  maxVariables: 5_000,
  maxStyles: 2_000,
  /** A text style's letter spacing and case, an effect style's blurs: a few. */
  maxAlso: 20,
} as const;

export const PLAN_PATTERN = {
  /** What tokens_read writes for a value it cannot (an alias to nothing, an easing CSS lacks): left as it is. */
  comment: /^\/\*[\s\S]*\*\/$/,
  /** Figma refuses these in a variable's name (FX-051). */
  refusedName: /[.{}$]/,
  quoted: /^(['"])([\s\S]*)\1$/,
  escaped: /\\(.)/g,
  /** A `property: value` piece of a style's CSS. */
  declaration: /^([a-z-]+)\s*:\s*(.*)$/s,
} as const;

export const BOOLEAN_CSS = { true: "true", false: "false" } as const;

/** The order a value with no type yet is tried in: booleans and numbers before what a colour reader might take. */
export const GUESS_ORDER: readonly WritableType[] = [
  WRITABLE_TYPE.BOOLEAN,
  WRITABLE_TYPE.FLOAT,
  WRITABLE_TYPE.STRING,
  WRITABLE_TYPE.COLOR,
];

/** The type each kind of value gives a variable given none; an alias gives none. */
export const TYPE_OF_VALUE: Readonly<Record<PlanValue["kind"], WritableType | null>> = {
  [PLAN_VALUE.color]: WRITABLE_TYPE.COLOR,
  [PLAN_VALUE.number]: WRITABLE_TYPE.FLOAT,
  [PLAN_VALUE.string]: WRITABLE_TYPE.STRING,
  [PLAN_VALUE.boolean]: WRITABLE_TYPE.BOOLEAN,
  [PLAN_VALUE.alias]: null,
};

/** The style kinds in the order their items and errors are listed. */
export const STYLE_ORDER: readonly StyleGroup[] = [STYLE_GROUP.paint, STYLE_GROUP.text, STYLE_GROUP.effect];

/**
 * How each kind of style is read (C-173): the layer whose attribute means the same, that attribute, and those its CSS
 * may set after it (`; letter-spacing: 0.4px`) or in also; the longest first, so a token's suffix finds its own.
 */
export const STYLE_READ: Readonly<
  Record<StyleGroup, { readonly tag: string; readonly attribute: string; readonly extras: readonly string[] }>
> = {
  [STYLE_GROUP.paint]: { tag: TAG.FRAME, attribute: "background", extras: [] },
  [STYLE_GROUP.text]: { tag: TAG.TEXT, attribute: "font", extras: ["letter-spacing", "text-transform"] },
  [STYLE_GROUP.effect]: { tag: TAG.FRAME, attribute: "box-shadow", extras: ["backdrop-filter", "filter"] },
};

/** The parts a style token's name can end with (K-006): a text style's font, an effect style's blur alone. */
export const STYLE_SUFFIXES: readonly string[] = [MODEL_VALUE.font, ...STYLE_READ[STYLE_GROUP.effect].extras];

/** The effects each attribute of an effect style's CSS stands for: those it replaces, the style's others kept. */
export const EFFECT_COVERS: Readonly<Record<string, readonly (keyof typeof INTENT_EFFECT)[]>> = {
  "box-shadow": [INTENT_EFFECT.DROP_SHADOW, INTENT_EFFECT.INNER_SHADOW],
  filter: [INTENT_EFFECT.LAYER_BLUR],
  "backdrop-filter": [INTENT_EFFECT.BACKGROUND_BLUR],
};

/** Why a token cannot be planned (K-019..K-024), and what was planned but will not read back as given (K-022). */
export const PLAN_TEXT = {
  refusedName: (name: string) => `${name} has a character Figma refuses in a variable name: no . { } or $.`,
  notWritable: (type: string) => `${type} variables cannot be written yet: COLOR, FLOAT, STRING and BOOLEAN can.`,
  unreadable: (css: string) =>
    `${css} is not a colour, a length, a number, a quoted string, true/false or var(--token).`,
  notOfType: (css: string, type: string) => `${css} is not a ${type} value.`,
  twoNames: (
    token: string,
    web: string,
    named: string,
  ) =>
    `token ${token} and codeSyntax.WEB "${web}" (${named}) name two CSS properties: give one of them.`,
  typeChange: (type: string) =>
    `It is a ${type} variable in the file, and a variable's type cannot change: give the new one another name.`,
  library: (name: string) => `${name} comes from a library: change it there.`,
  noTarget: (token: string) => `${token} names no variable in this file or in this call.`,
  notColour: (token: string, type: string) => `${token} is a ${type} variable: a style takes colour variables.`,
  imported: (token: string) =>
    `${token} is a variable of an enabled library that the file does not use yet: the write imports it into the file.`,
  twice: (name: string, collection: string) =>
    `${name} is listed twice in ${collection}: only the first is planned. Merge the two, or give one another name.`,
  cycle: (path: readonly string[]) =>
    `${path.join(" → ")}: an alias cannot lead back to the variable it belongs to. Give one of them a value.`,
  typeClash: (
    token: string,
    target: string,
    own: string,
  ) =>
    `${token} is a ${target} variable and this one is ${own}: an alias takes a target of its own type. Point it at a ${own} variable, or change its type.`,
  noType: (name: string) =>
    `${name} has no value that gives its type: its values are comments, or aliases to variables whose type is not known. Give it a type or a value.`,
  unitless: (name: string, collection: string) =>
    `${name} (${collection}) holds plain numbers and no scope keeps them plain: Figma offers it for every field and tokens_read reads them back in px. Give it scopes (FONT_WEIGHT, OPACITY…) to keep them plain.`,
  suffix: (property: string) => `-${property}`,
  notPart: (
    piece: string,
    kind: string,
    takes: string,
  ) =>
    `${piece} is not part of a ${kind} style: it takes ${takes}.`,
  takesOnly: (attribute: string) => `only its ${attribute}`,
  takes: (attribute: string, extras: readonly string[]) => `its ${attribute}, then ${extras.join(", ")}`,
  image: (value: string) => `${value} is an image: a paint style holds colours and colour variables.`,
  noColour: "A paint style holds at least one colour.",
  notFont: (value: string) => `${value} is not a font shorthand.`,
  namesStyle: (value: string) => `${value} names another style: an effect style holds its shadows and blurs.`,
  joined: (errors: readonly string[]) => errors.join(" "),
} as const;

/** tokens_apply's input fields as clients read them: 0.7.0's words where the field was 0.7.0's. */
export const PLAN_FIELD = {
  scopes:
    'The fields Figma\'s pickers offer it for, by Figma\'s names: ["FONT_WEIGHT"], ["GAP", "WIDTH_HEIGHT"]; [] hides it from all of them. A new variable is offered for every field (ALL_SCOPES), which makes a number a length in px: a font weight or an opacity needs its scope.',
  codeSyntax: 'Its name in code per platform: WEB (also its CSS name, as var(--name)), ANDROID, iOS; "" removes one.',
  also: "Its letter spacing and case, or its blurs, as tokens_read lists them: [{token: '--Caption-letter-spacing', value: '0.04em'}, {token: '--Caption-text-transform', value: 'uppercase'}].",
  styleToken:
    "Its token as tokens_read lists it: which of the styles sharing its name it is, and which filter a blur alone is (--Frost-backdrop-filter).",
  readPast: "tokens_read's own: read past.",
} as const;
