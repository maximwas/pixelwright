import { CSS_ATTRIBUTES } from "../../css-mapping/vocabulary.ts";
import { type Channels, Color } from "../../kernel/color/color.ts";
import { colorSpaceOf } from "../../kernel/color/color-space.ts";
import { styleTokenName, variableTokenName } from "../../kernel/names.ts";
import type { Snapshot } from "../../types/snapshot.ts";
import { type DesignAttribute, type DesignElement, type DesignTree, elementsOf } from "../tree.ts";
import { EXAMPLES } from "./examples.ts";

/** Colours as design_read writes them raw: hex, rgba() and Display P3. */
const RAW_COLOR = /#[0-9A-F]{3,8}\b|rgba\([^)]*\)|color\(display-p3 [^)]*\)/g;

/** What the read's tokens leave to the code: styles named without a value, numbered styles, raw colours a token holds. */
export function tokenHints(snapshot: Snapshot, read: Pick<DesignTree, "root" | "tokens">): string[] {
  const values = valuesOf(read.root);

  return [
    ...valuelessTokenHints(snapshot, values, read.tokens),
    ...numberedTokenHints(snapshot, values, read.tokens),
    ...rawTokenHints(snapshot, read.root),
  ];
}

/** Paint styles the XML names whose value no layer here could give: a var() the build cannot resolve on its own. */
function valuelessTokenHints(
  snapshot: Snapshot,
  values: readonly string[],
  tokens: Readonly<Record<string, string>>,
): string[] {
  const missing = new Map<string, string>();

  for (const style of Object.values(snapshot.styles)) {
    const name = styleTokenName(style);

    if (
      style.paints !== undefined &&
      tokens[name] === undefined &&
      values.some((value) => value.includes(`var(${name})`))
    ) {
      missing.set(name, style.paints.map((paint) => paint.type.toLowerCase()).join(" + ") || "empty");
    }
  }

  return [...missing].map(
    ([name, paints]) =>
      `${name} has no value: its paint style is ${paints}, which neither core nor Figma wrote as CSS here; take its look from a screenshot of a layer that uses it.`,
  );
}

/** Each numbered style token the XML names (--White-2), with its value and the first one's: two styles, not one. */
function numberedTokenHints(
  snapshot: Snapshot,
  values: readonly string[],
  tokens: Readonly<Record<string, string>>,
): string[] {
  const hints = new Map<string, string>();

  for (const style of Object.values(snapshot.styles)) {
    const name = styleTokenName(style);

    if (style.duplicate === undefined || !values.some((value) => usesToken(value, name))) {
      continue;
    }

    const first = styleTokenName({ name: style.name });

    hints.set(
      name,
      `${name} is another ${style.type.toLowerCase()} style named ${style.name} (${tokens[name] ?? "no value here"}); ${first} is ${tokens[first] ?? "not used here"}: they are two styles, keep each where the layer names it.`,
    );
  }

  return [...hints.values()];
}

/**
 * A color written raw in CSS that equals a style's or a variable's value, named by the attribute and the layer it is on;
 * a colour in a name, a note or a link is no CSS.
 */
function rawTokenHints(snapshot: Snapshot, root: DesignElement | null): string[] {
  const tokens = colorTokens(snapshot);
  const uses = new Map<string, string[]>();

  for (const element of elementsOf(root)) {
    for (const [property, value] of attributesOf(element).filter(([name]) => CSS_ATTRIBUTES.has(name))) {
      for (const [color] of value.replace(/var\([^)]*\)/g, "").matchAll(RAW_COLOR)) {
        if (tokens.has(color)) {
          uses.set(color, [...(uses.get(color) ?? []), `${property} of ${element.id}`]);
        }
      }
    }
  }

  return [...uses].map(
    ([color, places]) =>
      `${color} is written raw ${places.length === 1 ? "once" : `${places.length} times`} (${places.slice(0, EXAMPLES).join(", ")}) and equals ${tokens.get(color)}: use the token.`,
  );
}

/** The CSS of each colour a one-colour paint style or a colour variable holds, as design_read writes it, by token. */
function colorTokens(snapshot: Snapshot): Map<string, string> {
  const space = colorSpaceOf(snapshot.colorProfile);
  const tokens = new Map<string, string>();

  for (const style of Object.values(snapshot.styles)) {
    const [paint, ...rest] = style.paints ?? [];

    if (rest.length === 0 && paint?.type === "SOLID" && paint.color !== undefined) {
      tokens.set(
        Color.of(paint.color, space)
          .faded(paint.opacity ?? 1)
          .css(),
        styleTokenName(style),
      );
    }
  }

  for (const variable of Object.values(snapshot.variables)) {
    const value = variable.value;

    if (variable.resolvedType === "COLOR" && typeof value === "object" && value !== null && "r" in value) {
      tokens.set(Color.of(value as Channels, space).css(), variableTokenName(variable));
    }
  }

  return tokens;
}

/** An element's attributes, then its spans': a run's are its text's. */
function attributesOf(element: DesignElement): DesignAttribute[] {
  const spans = (element.content ?? []).flatMap((piece) => (piece.kind === "span" ? piece.attributes : []));

  return [...element.attributes, ...spans];
}

/** Every attribute value of the read, its spans' included: where a var() names a token. */
function valuesOf(root: DesignElement | null): string[] {
  return elementsOf(root).flatMap((element) => attributesOf(element).map(([, value]) => value));
}

/** Whether a value names this token itself: var(--White-2) or var(--White-2, …), not var(--White-20). */
function usesToken(value: string, token: string): boolean {
  return value.includes(`var(${token})`) || value.includes(`var(${token},`);
}
