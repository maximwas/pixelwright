import * as zod from "zod/mini";
import { APPLY, APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";
import { FigmaPropsSchema } from "@/shared/write-intents/write-intent.schema.ts";

/** A Span's run over the text's characters, with what it sets over the text's own (C-119). */
const RunSchema = zod.strictObject({ start: zod.int(), end: zod.int(), props: FigmaPropsSchema });

/** One layer to make or change, in Figma's terms, as core's planner gives it (C-171). */
export const ApplyChangeSchema = zod.strictObject({
  line: zod.int(),
  column: zod.int(),
  kind: zod.enum(APPLY_CHANGE_KIND),
  ref: NodeIdSchema,
  id: zod.nullable(NodeIdSchema),
  tag: zod.string().check(zod.minLength(1), zod.maxLength(APPLY.tagChars)),
  parent: zod.nullable(NodeIdSchema),
  index: zod.int().check(zod.nonnegative()),
  before: zod.exactOptional(NodeIdSchema),
  after: zod.exactOptional(NodeIdSchema),
  props: FigmaPropsSchema,
  sources: zod.partialRecord(zod.keyof(FigmaPropsSchema), zod.string()),
  text: zod.exactOptional(
    zod.strictObject({ characters: zod.string().check(zod.maxLength(APPLY.characters)), runs: zod.array(RunSchema) }),
  ),
  moves: zod.exactOptional(zod.boolean()),
  copyOf: zod.exactOptional(NodeIdSchema),
  source: zod.exactOptional(NodeIdSchema),
  copy: zod.exactOptional(NodeIdSchema),
});

/** An element's error: where in the XML, on which layer and attribute, and what to do instead. */
export const ApplyErrorSchema = zod.object({
  line: zod.int(),
  column: zod.int(),
  id: zod.exactOptional(zod.string()),
  attribute: zod.exactOptional(zod.string()),
  message: zod.string(),
  hint: zod.exactOptional(zod.string()),
});

/** A layer made by its element's line and ref; a dry run's, which it would make, has no id and no name. */
export const ApplyCreatedSchema = zod.object({
  line: zod.int(),
  ref: zod.string(),
  id: zod.exactOptional(zod.string()),
  tag: zod.string(),
  name: zod.exactOptional(zod.string()),
});

export type ApplyChangeData = zod.output<typeof ApplyChangeSchema>;

export type ApplyCreated = zod.output<typeof ApplyCreatedSchema>;

export type ApplyErrorEntry = zod.output<typeof ApplyErrorSchema>;
