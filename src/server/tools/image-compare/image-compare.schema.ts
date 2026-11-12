import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { IMAGE_COMPARE, IMAGE_COMPARE_FIELD } from "@/server/tools/image-compare/image-compare.constants.ts";
import { ClipSchema } from "@/shared/ops/cover/cover.schema.ts";
import { ExportScaleSchema } from "@/shared/ops/export/export.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const PathSchema = zod.string().check(zod.minLength(1), zod.maxLength(IMAGE_COMPARE.pathChars));

/**
 * 0.8.0 reads only (plan 5.0): no `modes`, which switches a layer's variable modes for the render. Strict, so a client
 * that still sends it hears so rather than taking a plain render for one in its modes.
 */
export const ImageCompareInputSchema = zod.strictObject({
  node: NodeIdSchema.check(zod.describe(IMAGE_COMPARE_FIELD.node)),
  reference: zod.exactOptional(PathSchema).check(zod.describe(IMAGE_COMPARE_FIELD.reference)),
  against: zod.exactOptional(NodeIdSchema).check(zod.describe(IMAGE_COMPARE_FIELD.against)),
  scale: zod._default(ExportScaleSchema, IMAGE_COMPARE.scale).check(zod.describe(IMAGE_COMPARE_FIELD.scale)),
  effects: zod._default(zod.boolean(), IMAGE_COMPARE.effects).check(zod.describe(IMAGE_COMPARE_FIELD.effects)),
  clip: zod.exactOptional(ClipSchema).check(zod.describe(IMAGE_COMPARE_FIELD.clip)),
  diff: zod.exactOptional(PathSchema).check(zod.describe(IMAGE_COMPARE_FIELD.diff)),
  file: FileInputSchema,
});

const EdgeLinesSchema = zod.object({
  matched: zod.number(),
  shifted: zod.array(zod.object({ reference: zod.number(), node: zod.number(), by: zod.number() })),
  missing: zod.array(zod.number()),
  extra: zod.array(zod.number()),
});

const BoxSchema = zod.object({ x: zod.number(), y: zod.number(), width: zod.number(), height: zod.number() });

/** 0.7.0's answer (T-089). */
export const ImageCompareOutputSchema = zod.object({
  size: zod.object({ node: zod.string(), reference: zod.string() }),
  scale: zod.number(),
  rmse: zod.number().check(zod.describe(IMAGE_COMPARE_FIELD.rmse)),
  different: zod.number().check(zod.describe(IMAGE_COMPARE_FIELD.different)),
  box: zod.nullable(BoxSchema).check(zod.describe(IMAGE_COMPARE_FIELD.box)),
  rows: EdgeLinesSchema.check(zod.describe(IMAGE_COMPARE_FIELD.rows)),
  columns: EdgeLinesSchema.check(zod.describe(IMAGE_COMPARE_FIELD.columns)),
  diff: zod.exactOptional(zod.string()),
  note: zod.exactOptional(zod.string()),
});

export type ImageCompareInput = zod.output<typeof ImageCompareInputSchema>;
export type ImageCompareOutput = zod.output<typeof ImageCompareOutputSchema>;
