import * as zod from "zod/mini";
import { CHANGE_KIND } from "@/core/apply/apply.constants.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DryRunInputSchema, VersionInputSchema, WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { DESIGN_APPLY_FIELD, DESIGN_APPLY_LIMIT } from "@/server/tools/design-apply/design-apply.constants.ts";
import { ApplyCreatedSchema, ApplyPropertySchema } from "@/shared/ops/apply/apply.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

export const DesignApplyInputSchema = zod.strictObject({
  xml: zod
    .string()
    .check(zod.minLength(1), zod.maxLength(DESIGN_APPLY_LIMIT.xmlChars), zod.describe(DESIGN_APPLY_FIELD.xml)),
  parent: zod.exactOptional(NodeIdSchema.check(zod.describe(DESIGN_APPLY_FIELD.parent))),
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
  notWritten: zod.exactOptional(zod.array(zod.string())),
});

const ErrorSchema = zod.object({
  line: zod.number(),
  column: zod.number(),
  id: zod.exactOptional(zod.string()),
  attribute: zod.exactOptional(zod.string()),
  message: zod.string(),
  hint: zod.exactOptional(zod.string()),
});

/** One layer the call makes or changes, in Figma's terms: only what the layer does not have yet. */
const ChangeSchema = zod.object({
  line: zod.number(),
  column: zod.number(),
  kind: zod.enum(CHANGE_KIND),
  id: zod.nullable(zod.string()),
  ref: zod.string(),
  tag: zod.string(),
  parent: zod.nullable(zod.string()),
  // The write-intent contract (FigmaPropsSchema) is the op's input; listing it here would add ~1,900 lines to tools/list.
  props: zod.record(zod.string(), zod.unknown()),
  sources: zod.record(zod.string(), zod.string()),
  /** A Text's characters, and a run per Span with the props it sets over the text's own. */
  text: zod.exactOptional(
    zod.object({
      characters: zod.string(),
      runs: zod.array(
        zod.object({ start: zod.number(), end: zod.number(), props: zod.record(zod.string(), zod.unknown()) }),
      ),
    }),
  ),
});

export const DesignApplyOutputSchema = zod.object({
  elements: zod.array(ElementSchema).check(zod.describe(DESIGN_APPLY_FIELD.elements)),
  errors: zod.array(ErrorSchema).check(zod.describe(DESIGN_APPLY_FIELD.errors)),
  changes: zod.array(ChangeSchema).check(zod.describe(DESIGN_APPLY_FIELD.changes)),
  created: zod.array(ApplyCreatedSchema).check(zod.describe(DESIGN_APPLY_FIELD.created)),
  changed: zod.array(zod.string()).check(zod.describe(DESIGN_APPLY_FIELD.changed)),
  properties: zod.exactOptional(zod.array(ApplyPropertySchema).check(zod.describe(DESIGN_APPLY_FIELD.properties))),
  notes: zod.exactOptional(zod.array(ErrorSchema).check(zod.describe(DESIGN_APPLY_FIELD.notes))),
  ...WRITER_OUTPUT,
});

export type DesignApplyInput = zod.output<typeof DesignApplyInputSchema>;

export type DesignApplyOutput = zod.output<typeof DesignApplyOutputSchema>;
