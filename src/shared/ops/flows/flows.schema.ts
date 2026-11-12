import * as zod from "zod/mini";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";
import { ReactionSchema } from "@/shared/read-model/layer-values.schema.ts";

/** A screen of the page with its size in whole px. */
export const FlowScreenSchema = zod.strictObject({
  id: zod.string(),
  name: zod.string(),
  width: zod.number(),
  height: zod.number(),
});

/** The page; the current one when left out. */
export const FlowsOpInputSchema = zod.strictObject({ page: zod.exactOptional(NodeIdSchema) });

/** A layer of a screen with prototype interactions: its screen's id, and its reactions as design_read reads them. */
const ReactiveLayerSchema = zod.strictObject({
  screen: zod.string(),
  id: zod.string(),
  name: zod.string(),
  reactions: zod.array(ReactionSchema),
});

/**
 * The page's prototype as Figma keeps it (P-121): where its flows start, its screens, and their layers with
 * interactions; `more` when the op's time or FLOWS.maxLinks layers cut the walk.
 */
export const FlowsOpOutputSchema = zod.strictObject({
  page: zod.string(),
  starts: zod.array(zod.strictObject({ id: zod.string(), name: zod.string() })),
  screens: zod.array(FlowScreenSchema),
  layers: zod.array(ReactiveLayerSchema),
  more: zod.boolean(),
});

export type FlowsInput = zod.output<typeof FlowsOpInputSchema>;
export type FlowsRaw = zod.output<typeof FlowsOpOutputSchema>;
export type ReactiveLayer = zod.output<typeof ReactiveLayerSchema>;
