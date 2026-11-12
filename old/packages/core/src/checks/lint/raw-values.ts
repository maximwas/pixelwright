import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { MIXED } from "../../schemas/snapshot-values.ts";
import { NUMBER_FIELDS, numberFieldApplies, RADIUS_FIELDS, STROKE_FIELDS } from "../../tokens/bind/fields.ts";
import { colorValue, numberValue } from "../../tokens/bind/values.ts";
import type { SnapshotNode, SnapshotPaint } from "../../types/snapshot.ts";

/** A raw value on a layer: its field by CSS name, its value as design_read writes it, and its number when it is one. */
export interface RawValue {
  readonly field: string;
  readonly value: string;
  readonly amount?: number;
}

const isRawSolid = (paint: SnapshotPaint) =>
  paint.type === "SOLID" &&
  (paint.visible ?? true) &&
  paint.color !== undefined &&
  paint.boundVariables?.color === undefined;

/** The colours a layer paints with that no style or variable gives it: fills, a text's runs, strokes. */
export function rawColors(node: SnapshotNode, space: ColorSpace): RawValue[] {
  const raw = (paints: readonly SnapshotPaint[], field: string): RawValue[] =>
    paints.filter(isRawSolid).map((paint) => ({
      field,
      value: colorValue(
        paint.color ?? {
          r: 0,
          g: 0,
          b: 0,
        },
        paint.opacity ?? 1,
        space,
      ),
    }));
  const fills =
    node.fills === MIXED
      ? (node.text?.segments ?? []).flatMap((segment) =>
          segment.fillStyleId === "" ? raw(segment.fills, "color") : [],
        )
      : unstyled(node.fillStyleId)
        ? raw(node.fills ?? [], node.type === "TEXT" ? "color" : "background")
        : [];
  const strokes = unstyled(node.strokeStyleId) ? raw(node.strokes ?? [], "border") : [];

  return unique([...fills, ...strokes]);
}

/** The raw spacing, padding, radii, border widths and opacity of a layer, each once per value. */
export function rawNumbers(node: SnapshotNode): RawValue[] {
  const bound = (node.boundVariables ?? {}) as Record<string, unknown>;
  const fields: Readonly<Record<string, unknown>> = { ...node };
  const values: RawValue[] = [];

  for (const [field, { css }] of Object.entries(NUMBER_FIELDS)) {
    const amount = fields[field];

    if (numberFieldApplies(field, fields) && typeof amount === "number" && bound[field] === undefined) {
      if (css === "opacity" ? amount > 0 && amount < 1 : amount > 0) {
        values.push({
          field: css,
          value: numberValue(field, amount),
          amount,
        });
      }
    }
  }

  values.push(
    ...fourFields(node, fields, {
      corners: RADIUS_FIELDS,
      single: "cornerRadius",
      css: "border-radius",
    }),
  );

  if ((node.strokes ?? []).some((paint) => paint.visible ?? true)) {
    values.push(
      ...fourFields(node, fields, {
        corners: STROKE_FIELDS,
        single: "strokeWeight",
        css: "border-width",
      }),
    );
  }

  return unique(values);
}

/** A radius or border width: the one value of a layer whose four agree, else each corner's or side's own. */
function fourFields(
  node: SnapshotNode,
  fields: Readonly<Record<string, unknown>>,
  { corners, single, css }: { corners: readonly string[]; single: string; css: string },
): RawValue[] {
  const bound = (node.boundVariables ?? {}) as Record<string, unknown>;
  const own = fields[single];
  const value = (field: string, amount: number): RawValue => ({
    field: css,
    value: numberValue(field, amount),
    amount,
  });

  if (typeof own === "number") {
    return own <= 0 || [single, ...corners].some((field) => bound[field] !== undefined) ? [] : [value(single, own)];
  }

  return corners.flatMap((field) => {
    const amount = fields[field];

    return typeof amount === "number" && amount > 0 && bound[field] === undefined ? [value(field, amount)] : [];
  });
}

/** Whether a layer's style field names no style (left out, or empty). */
function unstyled(styleId: unknown): boolean {
  return styleId === undefined || styleId === "";
}

function unique(values: readonly RawValue[]): RawValue[] {
  const seen = new Set<string>();

  return values.filter(({ field, value }) => {
    const key = `${field} ${value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
