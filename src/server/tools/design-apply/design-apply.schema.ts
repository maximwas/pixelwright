import * as zod from "zod/mini";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DryRunInputSchema, VersionInputSchema, WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { DESIGN_APPLY_FIELD, DESIGN_APPLY_LIMIT } from "@/server/tools/design-apply/design-apply.constants.ts";

export const DesignApplyInputSchema = zod.strictObject({
  xml: zod
    .string()
    .check(zod.minLength(1), zod.maxLength(DESIGN_APPLY_LIMIT.xmlChars), zod.describe(DESIGN_APPLY_FIELD.xml)),
  dryRun: DryRunInputSchema,
  version: VersionInputSchema,
  file: FileInputSchema,
});

const ContentPieceSchema = zod.object({
  line: zod.number(),
  column: zod.number(),
  kind: zod.enum(XML_CONTENT),
  value: zod.string(),
  attributes: zod.exactOptional(zod.record(zod.string(), zod.string())),
});

const ElementSchema = zod.object({
  line: zod.number(),
  column: zod.number(),
  tag: zod.string(),
  id: zod.nullable(zod.string()),
  ref: zod.string(),
  parent: zod.nullable(zod.string()),
  index: zod.number(),
  attributes: zod.record(zod.string(), zod.string()),
  content: zod.exactOptional(zod.array(ContentPieceSchema)),
  source: zod.exactOptional(zod.string()),
  copy: zod.exactOptional(zod.string()),
});

const ErrorSchema = zod.object({
  line: zod.number(),
  column: zod.number(),
  id: zod.exactOptional(zod.string()),
  attribute: zod.exactOptional(zod.string()),
  message: zod.string(),
  hint: zod.exactOptional(zod.string()),
});

export const DesignApplyOutputSchema = zod.object({
  elements: zod.array(ElementSchema).check(zod.describe(DESIGN_APPLY_FIELD.elements)),
  errors: zod.array(ErrorSchema).check(zod.describe(DESIGN_APPLY_FIELD.errors)),
  ...WRITER_OUTPUT,
});

export type DesignApplyInput = zod.output<typeof DesignApplyInputSchema>;

export type DesignApplyOutput = zod.output<typeof DesignApplyOutputSchema>;
