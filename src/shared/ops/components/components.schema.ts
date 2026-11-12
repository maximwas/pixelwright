import * as zod from "zod/mini";
import {
  COMPONENT_TYPE,
  COMPONENTS,
  COMPONENTS_FIELD,
  COMPONENTS_SCOPE,
} from "@/shared/ops/components/components.constants.ts";
import { PageNotReadSchema } from "@/shared/ops/file-map/file-map.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/**
 * What to list (T-190): the components the instances in a layer or page come from (used), or the ones the file defines
 * (local), on every page or within one layer; by a name substring, at most `limit`; with links, their Dev Mode links
 * (T-192).
 */
export const ComponentsOpInputSchema = zod.strictObject({
  scope: zod.enum(COMPONENTS_SCOPE),
  within: zod.exactOptional(NodeIdSchema),
  query: zod.exactOptional(zod.string().check(zod.minLength(COMPONENTS.minChars), zod.maxLength(COMPONENTS.maxChars))),
  limit: zod.int().check(zod.minimum(COMPONENTS.minLimit), zod.maximum(COMPONENTS.maxLimit)),
  links: zod.boolean(),
  /** Each component's instances, with their pages. */
  instances: zod.exactOptional(zod.boolean()),
  /** Per property, the layers bound to it. */
  references: zod.exactOptional(zod.boolean()),
});

/** A property's definition by the name Figma shows: a variant with its options, a slot without a default (B-060). */
const PropertySchema = zod.object({
  type: zod.string(),
  default: zod.exactOptional(zod.union([zod.string(), zod.boolean()])),
  options: zod.exactOptional(zod.array(zod.string())),
});

const PropertiesSchema = zod.record(zod.string(), PropertySchema);

/**
 * A nested instance a component exposes: its set's (or component's) name, key and properties, its values inside the
 * component as the defaults; for a set, the variants that expose it when not all do.
 */
const ExposedSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  component: zod.string(),
  key: zod.string(),
  properties: PropertiesSchema,
  variants: zod.exactOptional(zod.array(zod.string())),
});

/** An instance of a component, and the page it is on. */
const InstanceNodeSchema = zod.object({ id: zod.string(), name: zod.string(), page: zod.string() });

/** A layer bound to a property: which of its fields the property drives (visible, characters, mainComponent). */
const ReferenceSchema = zod.object({ id: zod.string(), name: zod.string(), field: zod.string() });

/** A Dev Mode link people attached (T-192): on a set, the variant it is on. */
export const ComponentLinkSchema = zod.object({
  name: zod.string(),
  url: zod.string(),
  on: zod.exactOptional(zod.string()).check(zod.describe(COMPONENTS_FIELD.on)),
});

/**
 * A component or set as listed (T-190): properties from the set or a lone component only, empty with Figma's words in
 * `error` when it refuses them (FX-028); a used one with how many instances use it.
 */
export const ComponentEntrySchema = zod.object({
  id: zod.string(),
  key: zod.string(),
  type: zod.enum(COMPONENT_TYPE),
  name: zod.string(),
  page: zod.nullable(zod.string()),
  remote: zod.boolean(),
  description: zod.exactOptional(zod.string()),
  variants: zod.exactOptional(zod.array(zod.object({ id: zod.string(), name: zod.string() }))),
  properties: PropertiesSchema,
  instances: zod.exactOptional(zod.int()),
  instanceNodes: zod.exactOptional(zod.array(InstanceNodeSchema)).check(zod.describe(COMPONENTS_FIELD.instanceNodes)),
  instanceNodesMore: zod.exactOptional(zod.literal(true)).check(zod.describe(COMPONENTS_FIELD.instanceNodesMore)),
  instanceNodesSkipped: zod.exactOptional(zod.literal(true)).check(zod.describe(COMPONENTS_FIELD.instanceNodesSkipped)),
  references: zod
    .exactOptional(zod.record(zod.string(), zod.array(ReferenceSchema)))
    .check(zod.describe(COMPONENTS_FIELD.references)),
  exposed: zod.exactOptional(zod.array(ExposedSchema)),
  links: zod.exactOptional(zod.array(ComponentLinkSchema)),
  error: zod.exactOptional(zod.string()),
});

/** The components listed, whether there are more, the pages Figma could not load, and why links were not read. */
export const ComponentsOpOutputSchema = zod.object({
  components: zod.array(ComponentEntrySchema),
  more: zod.boolean(),
  pagesNotRead: zod.exactOptional(zod.array(PageNotReadSchema)),
  linksNote: zod.exactOptional(zod.string()),
});

export type ComponentEntry = zod.output<typeof ComponentEntrySchema>;

export type ComponentLink = zod.output<typeof ComponentLinkSchema>;

export type ExposedInstance = zod.output<typeof ExposedSchema>;

export type PropertyDefinitions = zod.output<typeof PropertiesSchema>;

export type PropertyReference = zod.output<typeof ReferenceSchema>;
