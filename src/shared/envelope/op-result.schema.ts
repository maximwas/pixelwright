import * as zod from "zod/mini";
import { CUT_REASON, OP_RESULT_FIELD } from "@/shared/envelope/op-result.constants.ts";

/** A failure on the wire: the code stays a string, so a code a newer plugin sends still parses. */
const WireErrorSchema = zod.object({
  code: zod.string(),
  message: zod.string(),
  hint: zod.optional(zod.string()),
  data: zod.optional(zod.unknown()),
});

const CutSchema = zod.object({
  id: zod.string(),
  reason: zod.enum(CUT_REASON),
  detail: zod.optional(zod.string()),
});

/**
 * What `run` answers (D-05): the data with what was cut, missing and touched, or the error. Expected failures travel
 * here, never as a thrown birpc error (A§5.4). The server parses `data` with the op's own output schema.
 */
export const OpResultSchema = zod.discriminatedUnion(OP_RESULT_FIELD, [
  zod.object({
    ok: zod.literal(true),
    data: zod.unknown(),
    cuts: zod.array(CutSchema),
    missing: zod.array(zod.string()),
    touched: zod.array(zod.string()),
  }),
  zod.object({
    ok: zod.literal(false),
    error: WireErrorSchema,
  }),
]);

export type WireError = zod.output<typeof WireErrorSchema>;

export type OpResult = zod.output<typeof OpResultSchema>;
