import { colorCss, type Rgba } from "../css/color.ts";
import { decimal } from "../css/format.ts";
import { shadowListCss } from "../css/node-css.ts";
import { fontShorthand } from "../css/text.ts";
import { styleTokenName, tokenName, variableTokenName } from "../css/tokens.ts";
import type { RawTokens, StyleToken, TokenCollection, TokenModel } from "../types/tokens.ts";

/** Scopes a number is used for without a unit; anything else (or no scope) is a length in pixels. */
const UNITLESS_SCOPES: ReadonlySet<string> = new Set(["OPACITY", "COLOR_OPACITY", "FONT_WEIGHT"]);

const EASINGS: Readonly<Record<string, string>> = {
  LINEAR: "linear",
  EASE_IN: "ease-in",
  EASE_OUT: "ease-out",
  EASE_IN_AND_OUT: "ease-in-out",
  EASE_IN_BACK: "cubic-bezier(0.36, 0, 0.66, -0.56)",
  EASE_OUT_BACK: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  EASE_IN_AND_OUT_BACK: "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
  HOLD: "step-end",
};

/**
 * A file's tokens ready for code: each collection with its modes by name, each variable named the way design_read
 * names it and written as CSS in every mode (an alias as `var(--other)`), and the paint, text and effect styles.
 */
export function tokenModel(raw: RawTokens, filter: { collections?: readonly string[] } = {}): TokenModel {
  const notes: string[] = [];
  const names = new Map<string, string>();

  for (const variable of raw.variables) {
    names.set(variable.id, variableTokenName(variable));
  }

  for (const [id, variable] of Object.entries(raw.external)) {
    names.set(id, variableTokenName(variable));
  }

  const wanted = filter.collections?.map((name) => name.toLowerCase());
  const collections: TokenCollection[] = raw.collections
    .filter((collection) => wanted === undefined || wanted.includes(collection.name.toLowerCase()))
    .map((collection) => {
      const modeName = new Map(collection.modes.map(({ modeId, name }) => [modeId, name]));

      return {
        name: collection.name,
        modes: collection.modes.map(({ name }) => name),
        defaultMode: modeName.get(collection.defaultModeId) ?? collection.modes[0]?.name ?? "",
        selectors: {},
        variables: raw.variables
          .filter((variable) => variable.collectionId === collection.id)
          .map((variable) => ({
            name: variable.name,
            token: names.get(variable.id) ?? tokenName(variable.name),
            type: variable.resolvedType,
            values: Object.fromEntries(
              collection.modes.map(({ modeId, name }) => [
                name,
                valueCss(variable.valuesByMode[modeId], variable, {
                  names,
                  notes,
                }),
              ]),
            ),
            ...(variable.description === undefined ? {} : { description: variable.description }),
          })),
      };
    });

  selectorsOf(collections, notes);
  missingTargets(collections, raw, names, notes);

  return {
    collections,
    styles: stylesOf(raw.styles, notes),
    ...(raw.library === undefined ? {} : { library: raw.library }),
    notes: [...new Set(notes)],
  };
}

interface ValueContext {
  readonly names: ReadonlyMap<string, string>;
  readonly notes: string[];
}

function valueCss(value: unknown, variable: RawTokens["variables"][number], context: ValueContext): string {
  const alias = aliasOf(value);

  if (alias !== null) {
    const target = context.names.get(alias);

    if (target === undefined) {
      context.notes.push(
        `${variable.name} points at variable ${alias}, which is neither in this file nor in a library it uses.`,
      );

      return `/* unresolved alias ${alias} */`;
    }

    return `var(${target})`;
  }

  switch (variable.resolvedType) {
    case "COLOR":
      return colorValue(value, variable, context);
    case "FLOAT":
      return typeof value === "number" ? numberCss(value, variable.scopes) : unknownValue(value, variable, context);
    case "STRING":
      return typeof value === "string"
        ? `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
        : unknownValue(value, variable, context);
    case "BOOLEAN":
      context.notes.push(`${variable.name} is a boolean: CSS has no booleans, it is written as true or false.`);

      return String(value);
    case "EASING":
      return easingCss(value, variable, context);
    case "TIMING":
      return typeof value === "number" ? `${decimal(value)}s` : unknownValue(value, variable, context);
    default:
      return unknownValue(value, variable, context);
  }
}

/** A color, or a composed one (a color and an opacity, either of them a variable). */
function colorValue(value: unknown, variable: RawTokens["variables"][number], context: ValueContext): string {
  if (isRgba(value)) {
    return colorCss(value);
  }

  if (typeof value === "object" && value !== null && "color" in value && "opacity" in value) {
    const color = isRgba(value.color) ? colorCss(value.color) : valueCss(value.color, variable, context);
    // Figma keeps the opacity of a composed colour as a percentage; a value up to 1 is read as a fraction.
    const opacity =
      typeof value.opacity === "number"
        ? `${decimal(value.opacity > 1 ? value.opacity : value.opacity * 100)}%`
        : `calc(${valueCss(value.opacity, variable, context)} * 1%)`;

    return `color-mix(in srgb, ${color} ${opacity}, transparent)`;
  }

  return unknownValue(value, variable, context);
}

function numberCss(value: number, scopes: readonly string[]): string {
  const unitless = scopes.length > 0 && scopes.every((scope) => UNITLESS_SCOPES.has(scope));
  // An opacity is a percentage in Figma's opacity fields; CSS wants a fraction. A value up to 1 already is one.
  const percent = scopes.some((scope) => scope === "OPACITY" || scope === "COLOR_OPACITY") && value > 1;

  if (unitless) {
    return decimal(percent ? value / 100 : value);
  }

  return value === 0 ? "0" : `${decimal(value)}px`;
}

/**
 * The selector of each mode block: `[data-<collection>="<mode>"]` with letters of any script kept; two modes (or two
 * collections) that would share one get -2, and a note says so.
 */
function selectorsOf(collections: TokenCollection[], notes: string[]): void {
  const attributes = new Set<string>();

  for (const collection of collections) {
    const attribute = unique(attributeSlug(collection.name), attributes);
    const values = new Set<string>();

    for (const mode of collection.modes.filter((name) => name !== collection.defaultMode)) {
      const wanted = attributeSlug(mode);
      const slug = unique(wanted, values);

      if (slug !== wanted) {
        notes.push(`Mode "${mode}" of ${collection.name} would share the selector value "${wanted}": it is "${slug}".`);
      }

      collection.selectors[mode] = `[data-${attribute}="${slug}"]`;
    }
  }
}

/** A name as an HTML attribute name or value: lower case, letters and digits of any script, the rest as "-". */
function attributeSlug(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned === "" ? "mode" : cleaned;
}

function unique(wanted: string, taken: Set<string>): string {
  let candidate = wanted;

  for (let index = 2; taken.has(candidate); index++) {
    candidate = `${wanted}-${index}`;
  }

  taken.add(candidate);

  return candidate;
}

/** Every var() the output uses but does not define: which collection holds it, so it can be asked for. */
function missingTargets(
  collections: readonly TokenCollection[],
  raw: RawTokens,
  names: ReadonlyMap<string, string>,
  notes: string[],
): void {
  const defined = new Set(collections.flatMap((collection) => collection.variables.map((variable) => variable.token)));
  const homes = new Map<string, string>();

  for (const variable of raw.variables) {
    const home = raw.collections.find((collection) => collection.id === variable.collectionId)?.name ?? "";

    homes.set(names.get(variable.id) ?? "", home);
  }

  for (const [id, variable] of Object.entries(raw.external)) {
    homes.set(names.get(id) ?? "", variable.collection === "" ? "a library" : `${variable.collection} (a library)`);
  }

  const missing = new Set<string>();

  for (const collection of collections) {
    for (const variable of collection.variables) {
      for (const value of Object.values(variable.values)) {
        for (const [, token] of value.matchAll(/var\((--[^)]+)\)/g)) {
          if (token !== undefined && !defined.has(token)) {
            missing.add(token);
          }
        }
      }
    }
  }

  for (const token of missing) {
    const home = homes.get(token) ?? "";

    notes.push(
      home === ""
        ? `${token} is used but defined nowhere in this output.`
        : `${token} is used but not in this output: it is in ${home}; add that collection to collections.`,
    );
  }
}

function easingCss(value: unknown, variable: RawTokens["variables"][number], context: ValueContext): string {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return unknownValue(value, variable, context);
  }

  const bezier =
    "easingFunctionCubicBezier" in value
      ? (value.easingFunctionCubicBezier as Record<string, number> | undefined)
      : undefined;

  if (value.type === "CUSTOM_CUBIC_BEZIER" && bezier !== undefined) {
    return `cubic-bezier(${[bezier.x1, bezier.y1, bezier.x2, bezier.y2].map((point) => decimal(point ?? 0)).join(", ")})`;
  }

  const named = EASINGS[String(value.type)];

  if (named !== undefined) {
    return named;
  }

  context.notes.push(
    `${variable.name} is a spring easing (${String(value.type)}): CSS has no springs, it is written as ease.`,
  );

  return "ease";
}

function unknownValue(value: unknown, variable: RawTokens["variables"][number], context: ValueContext): string {
  context.notes.push(
    `${variable.name} has a ${variable.resolvedType} value CSS cannot hold: ${JSON.stringify(value)}.`,
  );

  return `/* ${JSON.stringify(value)} */`;
}

function stylesOf(styles: RawTokens["styles"], notes: string[]): TokenModel["styles"] {
  const paint: StyleToken[] = [];
  const text: StyleToken[] = [];
  const effect: StyleToken[] = [];

  for (const style of styles) {
    const token = styleTokenName(style);

    if (style.type === "PAINT") {
      const visible = (style.paints ?? []).filter((paint) => paint.visible !== false);
      const [only] = visible;

      if (visible.length === 1 && only?.type === "SOLID" && only.color !== undefined) {
        paint.push({
          name: style.name,
          token,
          value: colorCss(only.color, only.opacity ?? 1),
        });
      } else {
        notes.push(
          `Paint style ${style.name} is ${visible.map((layer) => layer.type.toLowerCase()).join(" + ") || "empty"}: only a single solid color is a token yet.`,
        );
      }
    } else if (
      style.type === "TEXT" &&
      style.fontName !== undefined &&
      style.fontSize !== undefined &&
      style.lineHeight !== undefined
    ) {
      text.push({
        name: style.name,
        token: `${token}-font`,
        value: fontShorthand({
          fontName: style.fontName,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
        }),
      });
    } else if (style.type === "EFFECT") {
      const shadows = shadowListCss(style.effects ?? []);

      if (shadows === "") {
        notes.push(`Effect style ${style.name} holds no shadow: blurs are not tokens yet.`);
      } else {
        effect.push({
          name: style.name,
          token,
          value: shadows,
        });
      }
    }
  }

  for (const [kind, tokens] of [
    ["Paint", paint],
    ["Effect", effect],
    ["Text", text],
  ] as const) {
    const byName = Map.groupBy(tokens, ({ name }) => name);

    for (const [name, group] of byName) {
      if (group.length > 1) {
        notes.push(
          `${kind} styles named ${name} are ${group.length} different styles: ${group.map(({ token, value }) => `${token} ${value}`).join(", ")}.`,
        );
      }
    }
  }

  return {
    paint,
    text,
    effect,
  };
}

function aliasOf(value: unknown): string | null {
  return typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "VARIABLE_ALIAS" &&
    "id" in value
    ? String(value.id)
    : null;
}

function isRgba(value: unknown): value is Rgba {
  return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
}
