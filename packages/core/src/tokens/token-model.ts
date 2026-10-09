import { colorCss, type Rgba } from "../css/color.ts";
import { decimal } from "../css/format.ts";
import { shadowListCss } from "../css/node-css.ts";
import { fontShorthand } from "../css/text.ts";
import { tokenName, variableTokenName } from "../css/tokens.ts";
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
    const opacity =
      typeof value.opacity === "number"
        ? `${Math.round(value.opacity * 100)}%`
        : `calc(${valueCss(value.opacity, variable, context)} * 100%)`;

    return `color-mix(in srgb, ${color} ${opacity}, transparent)`;
  }

  return unknownValue(value, variable, context);
}

function numberCss(value: number, scopes: readonly string[]): string {
  const unitless = scopes.length > 0 && scopes.every((scope) => UNITLESS_SCOPES.has(scope));

  return unitless ? decimal(value) : value === 0 ? "0" : `${decimal(value)}px`;
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
    const token = tokenName(style.name);

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
