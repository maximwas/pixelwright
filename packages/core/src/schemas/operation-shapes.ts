import * as z from "zod";
import type { OutlineNode } from "../types/operations.ts";

/** A node's box in page coordinates, whole pixels. */
export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/** A layer by id and name. */
export const LayerNameSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** A layer in the file map: what it is and its size. */
export const MapNodeSchema = LayerNameSchema.extend({
  type: z.string(),
  width: z.number(),
  height: z.number(),
  /** What the designer marked in Dev Mode: ready for development, or completed. */
  devStatus: z.enum(["ready", "completed"]).exactOptional(),
});

/** A node as lists show it: enough to name it, find it again and point at it. */
export const NodeRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  box: BoxSchema.nullable(),
});

/**
 * A layer in an outline: its box relative to the outlined root (none for a page), the number of its children, and
 * those children up to the outline's depth.
 */
export const OutlineNodeSchema: z.ZodType<OutlineNode> = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  /** An instance's component (its set for a variant) and the variant, so repeated components show. */
  component: z.string().exactOptional(),
  variant: z.string().exactOptional(),
  x: z.number().exactOptional(),
  y: z.number().exactOptional(),
  width: z.number().exactOptional(),
  height: z.number().exactOptional(),
  hidden: z.literal(true).exactOptional(),
  /** What the designer marked in Dev Mode: ready for development, or completed. */
  dev: z.enum(["ready", "completed"]).exactOptional(),
  /** Unknown for a page the user has not opened yet: Figma loads its layers only when asked. */
  childCount: z.number().int().min(0).exactOptional(),
  get children() {
    return z.array(OutlineNodeSchema).exactOptional();
  },
});

export const NodeIdSchema = z.string().min(1).max(200);

/** A component or component set as components_read lists it: variants under their set, properties from the set. */
/** A component property's definition: its type, its default, a variant's options. */
const PropertyDefinitionSchema = z.object({
  type: z.string(),
  /** None for a slot: what it holds is its instances' own layers. */
  default: z.union([z.string(), z.boolean()]).exactOptional(),
  options: z.array(z.string()).exactOptional(),
});

/**
 * A nested instance the component exposes (isExposedInstance): its instances show its properties, so in code they are
 * the component's props too. `component` and `key` are its set's (or component's); each property's default is its value
 * inside this component; `variants` names a set's variants that expose it, when not all do.
 */
const ExposedInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  component: z.string(),
  key: z.string(),
  properties: z.record(z.string(), PropertyDefinitionSchema),
  variants: z.array(z.string()).exactOptional(),
});

/** A link people attached in Dev Mode (a dev resource); `on` names the variant of a set it is on. */
const DevLinkSchema = z.object({
  name: z.string(),
  url: z.string(),
  on: z.string().exactOptional(),
});

export const ComponentEntrySchema = z.object({
  id: z.string(),
  key: z.string(),
  type: z.enum(["COMPONENT", "COMPONENT_SET"]),
  name: z.string(),
  page: z.string().nullable(),
  remote: z.boolean(),
  description: z.string().exactOptional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .exactOptional(),
  properties: z.record(z.string(), PropertyDefinitionSchema),
  /** How many instances use it, for scope used. */
  instances: z.number().int().exactOptional(),
  exposed: z.array(ExposedInstanceSchema).exactOptional(),
  /** Its Dev Mode links (a set's and its variants'), when they were asked for and Figma gave them. */
  links: z.array(DevLinkSchema).exactOptional(),
  /** Why its properties could not be read (a set with variant conflicts, say): the rest of the list is still read. */
  error: z.string().exactOptional(),
});

export const QuerySchema = z.string().min(1).max(200);
