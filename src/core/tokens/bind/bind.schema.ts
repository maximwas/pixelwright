import * as zod from "zod/mini";
import { BIND_RESULT_FIELD } from "@/core/tokens/bind/bind.constants.ts";
import { BIND_KIND } from "@/shared/ops/bind/bind.constants.ts";

/** Uses of one value in one field with one outcome, across layers: how many, and a few of the layers. */
const BindGroupSchema = zod.strictObject({
  kind: zod.enum(BIND_KIND),
  field: zod.string().check(zod.describe(BIND_RESULT_FIELD.field)),
  value: zod.string(),
  count: zod.int().check(zod.minimum(1)),
  examples: zod.array(zod.string()).check(zod.describe(BIND_RESULT_FIELD.examples)),
});

/** What tokens_bind found under its layers, by value (T-167): bound, waiting for a pick, or held by no token. */
export const BindResultSchema = zod.object({
  bound: zod.array(
    zod.extend(BindGroupSchema, {
      token: zod.string(),
      snapped: zod.exactOptional(zod.literal(true)).check(zod.describe(BIND_RESULT_FIELD.snapped)),
    }),
  ),
  ambiguous: zod.array(zod.extend(BindGroupSchema, { candidates: zod.array(zod.string()) })),
  unmatched: zod.array(BindGroupSchema).check(zod.describe(BIND_RESULT_FIELD.unmatched)),
  remapped: zod.array(zod.strictObject({ from: zod.string(), to: zod.string(), count: zod.int() })),
  /** Layers changed, or that a dry run would change. */
  layers: zod.int().check(zod.minimum(0)),
  errors: zod.array(zod.strictObject({ id: zod.string(), message: zod.string() })),
  notes: zod.array(zod.string()),
  /** The walk ran out of time before every layer: bind the rest with a narrower within. */
  more: zod.boolean(),
});

export type BindResult = zod.output<typeof BindResultSchema>;
