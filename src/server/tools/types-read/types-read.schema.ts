import * as zod from "zod/mini";
import { TYPES_READ, TYPES_READ_FIELD } from "@/server/tools/types-read/types-read.constants.ts";

export const TypesReadInputSchema = zod.strictObject({
  tools: zod
    .array(zod.string().check(zod.minLength(1), zod.maxLength(TYPES_READ.nameChars)))
    .check(zod.minLength(1), zod.maxLength(TYPES_READ.maxTools), zod.describe(TYPES_READ_FIELD.tools)),
});

const AnswerTypeSchema = zod.object({ tool: zod.string(), call: zod.string(), type: zod.string() });

export const TypesReadOutputSchema = zod.object({
  types: zod.array(AnswerTypeSchema).check(zod.describe(TYPES_READ_FIELD.types)),
  unknown: zod.array(zod.string()).check(zod.describe(TYPES_READ_FIELD.unknown)),
});

export type AnswerType = zod.output<typeof AnswerTypeSchema>;

export type TypesReadInput = zod.output<typeof TypesReadInputSchema>;

export type TypesReadOutput = zod.output<typeof TypesReadOutputSchema>;
