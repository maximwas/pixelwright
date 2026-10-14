import { boundVariable } from "../css-mapping/values/paints.ts";
import { Color } from "../kernel/color/color.ts";
import { colorSpaceOf } from "../kernel/color/color-space.ts";
import { styleTokenName, variableTokenName } from "../kernel/names.ts";
import { MIXED } from "../schemas/snapshot.ts";
import type { DesignAudit } from "../types/audit.ts";
import type { CssContext } from "../types/css.ts";
import type { Snapshot, SnapshotNode, SnapshotPaint } from "../types/snapshot.ts";

/** The grid spacing and radii are expected on. */
const GRID = 4;
/** How far apart two colour channels (0–255) may be and still look the same. */
const HAIR = 3;
/** Below this, sizes a pixel apart are a scale's own steps (12, 13, 14), not a slip. */
const NEAR_FROM = 16;
const SPACING_KEYS = [
  "itemSpacing",
  "counterAxisSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;
const RADIUS_KEYS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

type Tally = Map<string, { value: number; token?: string; count: number; where: string; full?: boolean }>;

/**
 * The scale a layer uses, from its snapshot: spacing, radii, font sizes, line heights and colours with how often each
 * is used, bound to a token or raw; and what is off it: values off the 4 px grid, raw colours a hair from (or equal to)
 * a token, sizes a pixel apart.
 */
export function designAudit(snapshot: Snapshot): DesignAudit {
  const context: CssContext = {
    styles: snapshot.styles,
    variables: snapshot.variables,
    colorSpace: colorSpaceOf(snapshot.colorProfile),
    tokens: new Map(),
    root: snapshot.root,
  };
  const spacing: Tally = new Map();
  const radii: Tally = new Map();
  const fontSizes: Tally = new Map();
  const lineHeights = new Map<string, number>();
  const colors = new Map<string, { value: string; token?: string; count: number }>();
  const add = (tally: Tally, value: number, where: string, token?: string, full = false) => {
    const key = `${value} ${token ?? ""}`;
    const entry = tally.get(key) ?? {
      value,
      count: 0,
      where,
      ...(token === undefined ? {} : { token }),
      ...(full ? { full } : {}),
    };

    entry.count += 1;
    tally.set(key, entry);
  };
  const color = (paint: SnapshotPaint, styleId: unknown) => {
    if (paint.visible === false || paint.type !== "SOLID" || paint.color === undefined) {
      return;
    }

    const style = typeof styleId === "string" && styleId !== "" ? snapshot.styles[styleId] : undefined;
    const variable = boundVariable(paint.boundVariables?.color, context);
    const token =
      style !== undefined ? styleTokenName(style) : variable !== null ? variableTokenName(variable) : undefined;
    const own = style?.paints?.find((each) => each.type === "SOLID")?.color ?? paint.color;
    const value = Color.of(own, context.colorSpace)
      .faded(paint.opacity ?? 1)
      .css();
    const key = `${value} ${token ?? ""}`;
    const entry = colors.get(key) ?? {
      value,
      count: 0,
      ...(token === undefined ? {} : { token }),
    };

    entry.count += 1;
    colors.set(key, entry);
  };
  const walk = (node: SnapshotNode) => {
    if (!node.visible) {
      return;
    }

    const where = `${node.id} "${node.name}"`;
    const bound = (node.boundVariables ?? {}) as Record<string, unknown>;
    const tokenOf = (key: string) => {
      const variable = boundVariable(bound[key], context);

      return variable === null ? undefined : variableTokenName(variable);
    };

    if (node.layoutMode !== undefined) {
      for (const key of SPACING_KEYS) {
        const value = node[key];
        // Space-between places the children itself: the gap set on the frame does nothing.
        const ignored = key === "itemSpacing" && node.primaryAxisAlignItems === "SPACE_BETWEEN";

        if (typeof value === "number" && value > 0 && !ignored) {
          add(spacing, value, `${key} of ${where}`, tokenOf(key));
        }
      }
    }

    // A radius of half the short side or more rounds the ends fully (a pill): its number is not a design choice.
    const full = (value: number) => value >= Math.min(node.width, node.height) / 2 - 0.5;

    if (typeof node.cornerRadius === "number" && node.cornerRadius > 0) {
      add(radii, node.cornerRadius, where, tokenOf("topLeftRadius"), full(node.cornerRadius));
    } else if (node.cornerRadius === MIXED) {
      for (const key of RADIUS_KEYS) {
        const value = node[key];

        if (typeof value === "number" && value > 0) {
          add(radii, value, where, tokenOf(key), full(value));
        }
      }
    }

    for (const paint of Array.isArray(node.fills) ? node.fills : []) {
      color(paint, node.fillStyleId);
    }

    for (const paint of Array.isArray(node.strokes) ? node.strokes : []) {
      color(paint, node.strokeStyleId);
    }

    for (const segment of node.text?.segments ?? []) {
      add(fontSizes, segment.fontSize, where);

      const height =
        segment.lineHeight.unit === "PIXELS"
          ? `${segment.lineHeight.value}px`
          : segment.lineHeight.unit === "PERCENT"
            ? `${segment.lineHeight.value}%`
            : "auto";

      lineHeights.set(height, (lineHeights.get(height) ?? 0) + 1);

      for (const paint of segment.fills) {
        color(paint, segment.fillStyleId);
      }
    }

    node.children?.forEach(walk);
  };

  walk(snapshot.root);

  const listed = (tally: Tally) =>
    [...tally.values()]
      .toSorted((a, b) => a.value - b.value)
      .map(({ value, count, token }) => ({
        value,
        count,
        ...(token === undefined ? {} : { token }),
      }));
  const colorList = [...colors.values()].toSorted((a, b) => b.count - a.count);
  const notes = [
    ...offGrid(spacing, "spacing"),
    ...offGrid(radii, "radius"),
    ...pixelApart(fontSizes, "font sizes"),
    ...pixelApart(spacing, "spacing values"),
    ...colorNotes(colorList),
  ];

  return {
    summary: `${spacing.size} spacing values, ${radii.size} radii, ${fontSizes.size} font sizes, ${colorList.length} colours (${colorList.filter((entry) => entry.token !== undefined).length} bound to tokens); ${notes.length} notes.`,
    spacing: listed(spacing),
    radii: listed(radii),
    fontSizes: listed(fontSizes),
    lineHeights: [...lineHeights].map(([value, count]) => ({
      value,
      count,
    })),
    colors: colorList,
    notes,
  };
}

function offGrid(tally: Tally, what: string): string[] {
  return [...tally.values()]
    .filter((entry) => entry.token === undefined && !entry.full && entry.value > 2 && entry.value % GRID !== 0)
    .map(
      (entry) =>
        `${entry.value}px is off the ${GRID}px grid (${what}, ${entry.where}${entry.count > 1 ? ` and ${entry.count - 1} more` : ""}).`,
    );
}

function pixelApart(tally: Tally, what: string): string[] {
  const values = [...new Set([...tally.values()].map((entry) => entry.value))].toSorted((a, b) => a - b);

  return values
    .slice(1)
    .map((value, index) => [values[index] as number, value] as const)
    .filter(([a, b]) => b - a <= 1 && a >= NEAR_FROM)
    .map(([a, b]) => `${a}px and ${b}px ${what} are a pixel apart: one of them on purpose?`);
}

function colorNotes(colors: readonly { value: string; token?: string; count: number }[]): string[] {
  const tokens = colors.filter((entry) => entry.token !== undefined);
  const notes: string[] = [];

  for (const raw of colors.filter((entry) => entry.token === undefined)) {
    const same = tokens.find((entry) => entry.value === raw.value);
    const near = tokens.find((entry) => entry.value !== raw.value && hairApart(entry.value, raw.value));

    if (same !== undefined) {
      notes.push(
        `${raw.value} is used raw ${raw.count === 1 ? "once" : `${raw.count} times`} and equals ${same.token}: bind the token.`,
      );
    } else if (near !== undefined) {
      notes.push(`${raw.value} is a hair from ${near.token} (${near.value}): the same colour, unbound?`);
    }
  }

  return notes;
}

function hairApart(a: string, b: string): boolean {
  const channels = (hex: string) => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;

    return [1, 3, 5].map((at) => Number.parseInt(full.slice(at, at + 2), 16));
  };

  if (!/^#[0-9A-F]{3}([0-9A-F]{3})?$/i.test(a) || !/^#[0-9A-F]{3}([0-9A-F]{3})?$/i.test(b)) {
    return false;
  }

  const [x, y] = [channels(a), channels(b)];

  return x.every((channel, index) => Math.abs(channel - (y[index] ?? 0)) <= HAIR);
}
