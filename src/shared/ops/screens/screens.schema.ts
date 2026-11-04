import * as zod from "zod/mini";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** A screen of a page: its size in whole px and its children's names. */
const PageScreenSchema = zod.strictObject({
  id: zod.string(),
  name: zod.string(),
  width: zod.number(),
  height: zod.number(),
  children: zod.array(zod.string()),
});

/** A screen, or a layer on one. */
export const ScreensOpInputSchema = zod.strictObject({ node: NodeIdSchema });

/** The screen the layer is on, and the page's other screens (P-123). */
export const ScreensOpOutputSchema = zod.strictObject({
  target: PageScreenSchema,
  screens: zod.array(PageScreenSchema),
});

export type ScreensInput = zod.output<typeof ScreensOpInputSchema>;
export type ScreensRaw = zod.output<typeof ScreensOpOutputSchema>;
export type PageScreen = zod.output<typeof PageScreenSchema>;
