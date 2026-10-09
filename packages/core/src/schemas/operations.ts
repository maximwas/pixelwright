import * as z from "zod";
import { EXPORT_CHUNK_BYTES } from "../constants/bridge.ts";
import type { OutlineNode } from "../types/operations.ts";
import { SnapshotSchema } from "./snapshot.ts";
import { RawTokensSchema } from "./tokens.ts";

/** A node's box in page coordinates, whole pixels. */
export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
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
  x: z.number().exactOptional(),
  y: z.number().exactOptional(),
  width: z.number().exactOptional(),
  height: z.number().exactOptional(),
  hidden: z.literal(true).exactOptional(),
  /** Unknown for a page the user has not opened yet: Figma loads its layers only when asked. */
  childCount: z.number().int().min(0).exactOptional(),
  get children() {
    return z.array(OutlineNodeSchema).exactOptional();
  },
});

const NodeIdSchema = z.string().min(1).max(200);

/** A component or component set as components_read lists it: variants under their set, properties from the set. */
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
  properties: z.record(
    z.string(),
    z.object({
      type: z.string(),
      default: z.union([z.string(), z.boolean()]),
      options: z.array(z.string()).exactOptional(),
    }),
  ),
  /** How many instances use it, for scope used. */
  instances: z.number().int().exactOptional(),
});

const QuerySchema = z.string().min(1).max(200);

/**
 * Every primitive the plugin runs, with what it takes and what it returns: the plugin parses the input with these and
 * the server parses the output, so both sides agree on one definition.
 */
export const OPERATION_SCHEMAS = {
  ping: {
    input: z.unknown(),
    output: z.object({ pong: z.literal(true) }),
  },
  selection: {
    input: z.unknown(),
    output: z.object({ nodes: z.array(NodeRefSchema) }),
  },
  show: {
    input: z.object({ node: NodeIdSchema }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      page: z.string(),
    }),
  },
  find: {
    input: z.object({
      name: QuerySchema.exactOptional(),
      type: QuerySchema.exactOptional(),
      text: QuerySchema.exactOptional(),
      component: QuerySchema.exactOptional(),
      within: NodeIdSchema.exactOptional(),
      limit: z.number().int().min(1).max(500).default(50),
    }),
    output: z.object({
      nodes: z.array(NodeRefSchema.extend({ path: z.array(z.string()) })),
      more: z.boolean(),
    }),
  },
  outline: {
    input: z.object({
      node: NodeIdSchema.exactOptional(),
      depth: z.number().int().min(1).max(10).default(3),
    }),
    output: z.object({ root: OutlineNodeSchema }),
  },
  export: {
    input: z.object({
      node: NodeIdSchema,
      format: z.enum(["PNG", "JPG", "SVG", "PDF"]),
      scale: z.number().min(0.01).max(4).default(1),
      /** With effects off, the node's own box: no shadow or outside stroke around it. */
      effects: z.boolean().default(true),
      offset: z.number().int().min(0).default(0),
      length: z.number().int().min(1).max(EXPORT_CHUNK_BYTES).default(EXPORT_CHUNK_BYTES),
      /** A raster export's longest side: the plugin lowers the scale to fit it. */
      maxSide: z.number().int().min(1).max(16_384).exactOptional(),
      /** One id per export the server reads: its chunks come from one render, apart from other exports read at once. */
      stream: z.string().min(1).max(64).exactOptional(),
    }),
    output: z.object({
      /** The scale the export was rendered at: lower than asked when it had to fit maxSide. */
      scale: z.number(),
      totalBytes: z.number().int().min(0),
      /** Base64 of the export's bytes from `offset`, at most `length` of them. */
      bytes: z.string(),
    }),
  },
  image: {
    input: z.object({
      hash: z.string().regex(/^[0-9a-f]{40}$/),
      stream: z.string().min(1).max(64).exactOptional(),
      offset: z.number().int().min(0).default(0),
      length: z.number().int().min(1).max(EXPORT_CHUNK_BYTES).default(EXPORT_CHUNK_BYTES),
    }),
    output: z.object({
      totalBytes: z.number().int().min(0),
      bytes: z.string(),
    }),
  },
  components: {
    input: z.object({
      /** local: the file's own components; used: those the instances in `within` (or the current page) come from. */
      scope: z.enum(["local", "used"]).default("used"),
      within: NodeIdSchema.exactOptional(),
      query: QuerySchema.exactOptional(),
      limit: z.number().int().min(1).max(500).default(100),
    }),
    output: z.object({
      components: z.array(ComponentEntrySchema),
      more: z.boolean(),
    }),
  },
  variables: {
    input: z.object({
      /** Also list the enabled libraries' variables (by name: their values need an import). */
      libraries: z.boolean().default(false),
    }),
    output: RawTokensSchema,
  },
  snapshot: {
    input: z.object({
      node: NodeIdSchema,
      /** Levels below the node to include; all of them when left out (the plugin's size budget still applies). */
      depth: z.number().int().min(0).max(100).exactOptional(),
      /**
       * Figma's own CSS (getCSSAsync, slow): for no layer, only for layers with what our table cannot write yet
       * (gradients, new effects, blend modes), or for all of them (the test oracle).
       */
      css: z.enum(["none", "unmapped", "all"]).default("none"),
    }),
    output: SnapshotSchema,
  },
} as const;
