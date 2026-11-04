import * as zod from "zod/mini";
import { ASSET_KIND } from "@/core/design/assets/assets.constants.ts";
import { ASSET_FILE_FORMAT, WEBP_QUALITY } from "@/server/app/assets/assets.constants.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { ASSETS_EXPORT, ASSETS_EXPORT_FIELD } from "@/server/tools/assets-export/assets-export.constants.ts";
import { ExportScaleSchema } from "@/shared/ops/export/export.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** 0.7.0's input (T-194); exactly one of nodes and from, which the tool checks. */
export const AssetsExportInputSchema = zod.strictObject({
  nodes: zod
    .exactOptional(zod.array(NodeIdSchema).check(zod.minLength(1), zod.maxLength(ASSETS_EXPORT.maxNodes)))
    .check(zod.describe(ASSETS_EXPORT_FIELD.nodes)),
  from: zod.exactOptional(NodeIdSchema).check(zod.describe(ASSETS_EXPORT_FIELD.from)),
  dir: zod
    .string()
    .check(zod.minLength(1), zod.maxLength(ASSETS_EXPORT.pathChars), zod.describe(ASSETS_EXPORT_FIELD.dir)),
  names: zod
    .exactOptional(
      zod.record(NodeIdSchema, zod.string().check(zod.minLength(1), zod.maxLength(ASSETS_EXPORT.nameChars))),
    )
    .check(zod.describe(ASSETS_EXPORT_FIELD.names)),
  format: zod.exactOptional(zod.enum(ASSET_FILE_FORMAT)).check(zod.describe(ASSETS_EXPORT_FIELD.format)),
  scale: zod.exactOptional(ExportScaleSchema).check(zod.describe(ASSETS_EXPORT_FIELD.scale)),
  width: zod
    .exactOptional(zod.number().check(zod.positive(), zod.maximum(ASSETS_EXPORT.maxWidth)))
    .check(zod.describe(ASSETS_EXPORT_FIELD.width)),
  quality: zod
    .exactOptional(zod.int().check(zod.minimum(WEBP_QUALITY.min), zod.maximum(WEBP_QUALITY.max)))
    .check(zod.describe(ASSETS_EXPORT_FIELD.quality)),
  original: zod._default(zod.boolean(), false).check(zod.describe(ASSETS_EXPORT_FIELD.original)),
  file: FileInputSchema,
});

export type AssetsExportInput = zod.output<typeof AssetsExportInputSchema>;

/** Each file written, what to know, and each layer not written with why (B-001: a video is marked). */
export const AssetsExportOutputSchema = zod.object({
  files: zod.array(
    zod.object({
      node: zod.string(),
      kind: zod.enum([ASSET_KIND.icon, ASSET_KIND.image]),
      format: zod.string(),
      path: zod.string(),
      planned: zod.exactOptional(zod.string()).check(zod.describe(ASSETS_EXPORT_FIELD.planned)),
      bytes: zod.number(),
    }),
  ),
  notes: zod.array(zod.string()),
  errors: zod.array(
    zod.object({
      node: zod.string(),
      message: zod.string(),
      kind: zod.exactOptional(zod.literal(ASSET_KIND.video)).check(zod.describe(ASSETS_EXPORT_FIELD.kind)),
    }),
  ),
});

export type AssetsExportOutput = zod.output<typeof AssetsExportOutputSchema>;
