import {
  type BindScope,
  NUMBER_FIELDS,
  numberFieldApplies,
  numberValue,
  RADIUS_FIELDS,
  STROKE_FIELDS,
} from "@pixelwright/core";
import type { BindContext } from "./bind-context.ts";
import { merged, type RawUse } from "./raw-use.ts";

type Fields = SceneNode & Record<string, unknown>;

/** Fields bound as one value: their CSS word and the scope their variables need. */
interface FieldGroup {
  readonly fields: readonly string[];
  readonly css: string;
  readonly scope: BindScope;
}

/** Four fields of one value (corners, sides), and the one field of layers that have no four. */
interface FourFields {
  readonly fields: readonly string[];
  readonly single: string;
  readonly css: string;
  readonly scope: BindScope;
}

const RADIUS: FourFields = {
  fields: RADIUS_FIELDS,
  single: "cornerRadius",
  css: "border-radius",
  scope: "CORNER_RADIUS",
};

const BORDER_WIDTH: FourFields = {
  fields: STROKE_FIELDS,
  single: "strokeWeight",
  css: "border-width",
  scope: "STROKE_FLOAT",
};

/** A layer's raw spacing, padding, radii, border widths and opacity, each bound on its own or as its group. */
export async function numberUses(layer: SceneNode, context: BindContext): Promise<RawUse[]> {
  const record = layer as Fields;
  const uses: (RawUse | null)[] = [];

  for (const [field, { css, scope }] of Object.entries(NUMBER_FIELDS)) {
    if (numberFieldApplies(field, record)) {
      uses.push(
        await numberUse(
          record,
          {
            fields: [field],
            css,
            scope,
          },
          context,
        ),
      );
    }
  }

  uses.push(...(await groupUses(record, RADIUS, context)));

  if (hasVisibleStrokes(record)) {
    uses.push(...(await groupUses(record, BORDER_WIDTH, context)));
  }

  return uses.filter((use) => use !== null);
}

/**
 * One value over several fields (four corners, four sides): one use binding them all when they agree, one per field
 * when they differ; a layer with only the one field (an ellipse's stroke) binds that.
 */
async function groupUses(
  layer: Fields,
  { fields, single, css, scope }: FourFields,
  context: BindContext,
): Promise<(RawUse | null)[]> {
  if (!fields.every((field) => typeof layer[field] === "number")) {
    return [
      await numberUse(
        layer,
        {
          fields: [single],
          css,
          scope,
        },
        context,
      ),
    ];
  }

  const values = new Set(fields.map((field) => layer[field]));
  const groups = values.size === 1 ? [fields] : fields.map((field) => [field]);
  const uses: (RawUse | null)[] = [];

  for (const group of groups) {
    uses.push(
      await numberUse(
        layer,
        {
          fields: group,
          css,
          scope,
        },
        context,
      ),
    );
  }

  return uses;
}

/** A raw number in the fields: not bound, not zero (nor a full opacity), with the variables that hold it. */
async function numberUse(layer: Fields, group: FieldGroup, context: BindContext): Promise<RawUse | null> {
  const { fields, css, scope } = group;
  const [first] = fields;
  const value = first === undefined ? undefined : layer[first];
  const bound = (layer.boundVariables ?? {}) as Record<string, unknown>;

  if (
    first === undefined ||
    typeof value !== "number" ||
    value <= 0 ||
    (css === "opacity" && value >= 1) ||
    fields.some((field) => bound[field] !== undefined)
  ) {
    return null;
  }

  const inferred = (layer.inferredVariables as Record<string, unknown> | undefined)?.[first];
  const own = context.index.numbers(value, {
    scope,
    modes: context.modes(layer),
  });

  return {
    layer,
    kind: "number",
    field: css,
    value: numberValue(first, value),
    candidates: merged(own, await context.inferred(inferred)),
    bind: async (candidate) => {
      const variable = await context.variable(candidate.id);

      for (const field of fields) {
        layer.setBoundVariable(field as VariableBindableNodeField, variable);
      }
    },
  };
}

function hasVisibleStrokes(layer: Fields): boolean {
  return Array.isArray(layer.strokes) && layer.strokes.some((paint: Paint) => paint.visible ?? true);
}
