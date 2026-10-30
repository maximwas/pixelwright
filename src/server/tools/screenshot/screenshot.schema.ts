import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { SCREENSHOT, SCREENSHOT_FIELD } from "@/server/tools/screenshot/screenshot.constants.ts";
import { ClipSchema } from "@/shared/ops/cover/cover.schema.ts";
import { ExportScaleSchema } from "@/shared/ops/export/export.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** 0.8.0 reads only (plan 5.0): no `modes`, which switches a layer's variable modes for the render. */
export const ScreenshotInputSchema = zod.object({
  node: NodeIdSchema.check(zod.describe(SCREENSHOT_FIELD.node)),
  scale: zod._default(ExportScaleSchema, SCREENSHOT.scale).check(zod.describe(SCREENSHOT_FIELD.scale)),
  effects: zod._default(zod.boolean(), SCREENSHOT.effects).check(zod.describe(SCREENSHOT_FIELD.effects)),
  save: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(SCREENSHOT.pathChars)))
    .check(zod.describe(SCREENSHOT_FIELD.save)),
  clip: zod.exactOptional(ClipSchema).check(zod.describe(SCREENSHOT_FIELD.clip)),
  file: FileInputSchema,
});

export type ScreenshotInput = zod.output<typeof ScreenshotInputSchema>;
