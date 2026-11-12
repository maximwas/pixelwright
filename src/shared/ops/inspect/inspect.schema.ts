import * as zod from "zod/mini";
import { INSPECT, INSPECT_GROUP } from "@/shared/ops/inspect/inspect.constants.ts";
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
  nodes: zod.exactOptional(zod.array(NodeIdSchema).check(zod.minLength(1), zod.maxLength(INSPECT.maxLayers))),
  /** Instead of nodes: this layer and the layers under it, `depth` levels (all by default). */
  within: zod.exactOptional(NodeIdSchema),
  depth: zod.exactOptional(zod.int().check(zod.minimum(0))),
  /** With within: only the layers that carry one of these groups are listed (and counted against the cap). */
  fields: zod.exactOptional(zod.array(zod.enum(INSPECT_GROUP)).check(zod.minLength(1))),
  relativeTo: zod.exactOptional(NodeIdSchema),
});

const ParentLayoutSchema = zod.extend(
  zod.pick(LayerFieldsSchema, {
    layoutMode: true,
    layoutWrap: true,
    primaryAxisAlignItems: true,
    counterAxisAlignItems: true,
    counterAxisAlignContent: true,
    itemSpacing: true,
    counterAxisSpacing: true,
    paddingTop: true,
    paddingRight: true,
    paddingBottom: true,
    paddingLeft: true,
    gridRowCount: true,
    gridColumnCount: true,
    gridRowGap: true,
    gridColumnGap: true,
    gridRowSizes: true,
    gridColumnSizes: true,
  }),
  { childCount: zod.number() },
);

/**
 * One layer as Figma has it (T-080, K-059): its read-model entry, children left out, with its parent, its layout box
 * (absoluteBoundingBox: a turned layer's bounds) and painted box (absoluteRenderBounds, null when Figma gives none) from
 * the origin, its parent's box and the padding of a parent whose auto layout places it (null for any other parent);
 * an instance's component's default of each property, keyed as its properties.
 */
const InspectedLayerSchema = zod.strictObject({
  ...LayerFieldsSchema.shape,
  parent: zod.nullable(zod.strictObject({ id: zod.string(), name: zod.string(), type: zod.string() })),
  box: BoxSchema,
  paintedBox: zod.nullable(BoxSchema),
  parentBox: zod.nullable(BoxSchema),
  parentPadding: zod.nullable(SidesSchema),
  defaults: zod.exactOptional(zod.record(zod.string(), zod.union([zod.string(), zod.boolean()]))),
  /** Its ancestors below the page, outermost first. */
  path: zod.exactOptional(zod.array(zod.strictObject({ id: zod.string(), name: zod.string(), type: zod.string() }))),
  /** The page the layer is on. */
  page: zod.exactOptional(zod.strictObject({ id: zod.string(), name: zod.string() })),
  /** The layout fields of a parent whose auto layout or grid places it. */
  parentLayout: zod.exactOptional(ParentLayoutSchema),
});

const { colorProfile, styles, variables } = ReadModelSchema.shape;

/** The layers found, in the order asked; the ids that are no layer; the origin; what the layers' paints refer to. */
export const InspectOpOutputSchema = zod.strictObject({
  origin: zod.nullable(zod.strictObject({ id: zod.string(), name: zod.string() })),
  layers: zod.array(InspectedLayerSchema),
  missing: zod.array(zod.string()),
  /** A subtree read left layers: the ids not read (as far as the scan reached). */
  more: zod.exactOptional(zod.literal(true)),
  leftIds: zod.exactOptional(zod.array(zod.string())),
  colorProfile,
  styles,
  variables,
});

export type InspectInput = zod.output<typeof InspectOpInputSchema>;

export type InspectRaw = zod.output<typeof InspectOpOutputSchema>;

export type InspectedLayer = InspectRaw["layers"][number];
