import { InjectionToken, injectable } from "@needle-di/core";
import { get } from "es-toolkit/compat";
import * as zod from "zod/mini";
import type { AnswerShape } from "@/core/ports/code-sandbox.port.ts";
import { SHAPE_SCHEMA } from "@/server/app/code-mode/code-mode.constants.ts";

/** The JSON Schema words a shape reads. */
interface JsonSchema {
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly additionalProperties?: JsonSchema | boolean;
  readonly items?: JsonSchema | boolean;
  readonly anyOf?: readonly JsonSchema[];
  readonly oneOf?: readonly JsonSchema[];
  readonly allOf?: readonly JsonSchema[];
  readonly $ref?: string;
}

/** A shape's parts before they are put together: the keys of a closed object, its fields' shapes, items and values. */
type Parts = {
  readonly keys: readonly string[] | undefined;
  readonly fields: readonly (readonly [string, AnswerShape | undefined])[];
  readonly items: AnswerShape | undefined;
  readonly values: AnswerShape | undefined;
};

/**
 * The keys a script may read of each pw answer, from its tool's outputSchema as JSON Schema: an object's keys when it
 * takes no others, its fields, an array's items, a record's values; a union's (or an intersection's) branches merged,
 * so a key of any branch reads; a $ref followed once, a recursive type left open where it repeats. A tool without an
 * outputSchema (design_read, screenshot) has no shape: its answer stays plain data.
 */
@injectable()
export class AnswerShapes {
  shape(output: zod.ZodMiniObject | undefined): AnswerShape | undefined {
    if (output === undefined) {
      return undefined;
    }

    const root = zod.toJSONSchema(output, { ...SHAPE_SCHEMA.options }) as JsonSchema;

    return this.#shape(root, root, new Set());
  }

  #shape(
    schema: JsonSchema | boolean | undefined,
    root: JsonSchema,
    seen: ReadonlySet<string>,
  ): AnswerShape | undefined {
    if (typeof schema !== "object") {
      return undefined;
    }

    const { $ref: reference } = schema;

    if (reference !== undefined) {
      return seen.has(reference)
        ? undefined
        : this.#shape(this.#resolved(root, reference), root, new Set([...seen, reference]));
    }

    const branches = [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])];

    if (branches.length > 0) {
      return branches
        .map((branch) => this.#shape(branch, root, seen))
        .reduce<AnswerShape | undefined>((one, other) => this.#merged(one, other), undefined);
    }

    const { properties, additionalProperties } = schema;

    return this.#built({
      keys: properties !== undefined && typeof additionalProperties !== "object" ? Object.keys(properties) : undefined,
      fields: Object.entries(properties ?? {}).map(([key, child]) => [key, this.#shape(child, root, seen)] as const),
      items: this.#shape(schema.items, root, seen),
      values: this.#shape(additionalProperties, root, seen),
    });
  }

  #merged(one: AnswerShape | undefined, other: AnswerShape | undefined): AnswerShape | undefined {
    if (one === undefined || other === undefined) {
      return one ?? other;
    }

    const names = new Set([...Object.keys(one.fields ?? {}), ...Object.keys(other.fields ?? {})]);

    return this.#built({
      keys: one.keys === undefined || other.keys === undefined ? undefined : [...new Set([...one.keys, ...other.keys])],
      fields: [...names].map((key) => [key, this.#merged(one.fields?.[key], other.fields?.[key])] as const),
      items: this.#merged(one.items, other.items),
      values: this.#merged(one.values, other.values),
    });
  }

  /** The shape of its parts, each left out when it says nothing; nothing at all when no part does. */
  #built({ keys, fields, items, values }: Parts): AnswerShape | undefined {
    const shaped = fields.flatMap(([key, shape]) => (shape === undefined ? [] : [[key, shape] as const]));
    const shape: AnswerShape = {
      ...(keys === undefined ? {} : { keys }),
      ...(shaped.length === 0 ? {} : { fields: Object.fromEntries(shaped) }),
      ...(items === undefined ? {} : { items }),
      ...(values === undefined ? {} : { values }),
    };

    return Object.keys(shape).length === 0 ? undefined : shape;
  }

  #resolved(root: JsonSchema, reference: string): JsonSchema | undefined {
    return reference === SHAPE_SCHEMA.root
      ? root
      : (get(root, reference.slice(SHAPE_SCHEMA.pointerStart).split(SHAPE_SCHEMA.separator)) as JsonSchema | undefined);
  }
}

export const ANSWER_SHAPES = new InjectionToken<AnswerShapes>("AnswerShapes");
