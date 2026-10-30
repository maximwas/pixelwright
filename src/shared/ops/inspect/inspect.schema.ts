import * as zod from "zod/mini";
import { INSPECT } from "@/shared/ops/inspect/inspect.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";
import { LayerFieldsSchema } from "@/shared/read-model/layer.schema.ts";
import { ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

const BoxSchema = zod.strictObject({ x: zod.number(), y: zod.number(), width: zod.number(), height: zod.number() });

const SidesSchema = zod.strictObject({
  top: zod.number(),
  right: zod.number(),
  bottom: zod.number(),
  left: zod.number(),
});

/** The layers to inspect, in order, and the layer whose top left their boxes start from (the page's without it). */
export const InspectOpInputSchema = zod.strictObject({
  nodes: zod.array(NodeIdSchema).check(zod.minLength(1), zod.maxLength(INSPECT.maxLayers)),
  relativeTo: zod.exactOptional(NodeIdSchema),
});

/**
 * One layer as Figma has it (T-080, K-059): its read-model entry, children left out, with its parent, its layout box
 * (absoluteBoundingBox: a turned layer's bounds) and painted box (absoluteRenderBounds, null when Figma gives none) from
 * the origin, its parent's box and the padding of a parent whose auto layout places it (null for any other parent).
 */
const InspectedLayerSchema = zod.strictObject({
  ...LayerFieldsSchema.shape,
  parent: zod.nullable(zod.strictObject({ id: zod.string(), name: zod.string(), type: zod.string() })),
  box: BoxSchema,
  paintedBox: zod.nullable(BoxSchema),
  parentBox: zod.nullable(BoxSchema),
  parentPadding: zod.nullable(SidesSchema),
});

const { colorProfile, styles, variables } = ReadModelSchema.shape;

/** The layers found, in the order asked; the ids that are no layer; the origin; what the layers' paints refer to. */
export const InspectOpOutputSchema = zod.strictObject({
  origin: zod.nullable(zod.strictObject({ id: zod.string(), name: zod.string() })),
  layers: zod.array(InspectedLayerSchema),
  missing: zod.array(zod.string()),
  colorProfile,
  styles,
  variables,
});

export type InspectInput = zod.output<typeof InspectOpInputSchema>;

export type InspectRaw = zod.output<typeof InspectOpOutputSchema>;

export type InspectedLayer = InspectRaw["layers"][number];
