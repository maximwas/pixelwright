import * as z from "zod";
import { SELECTION_WAIT_MAX_MS } from "../constants/bridge.ts";
import { ScreensRawSchema } from "./breakpoints.ts";
import {
  BoxSchema,
  LayerNameSchema,
  MapNodeSchema,
  NodeIdSchema,
  NodeRefSchema,
  OutlineNodeSchema,
  QuerySchema,
} from "./operation-shapes.ts";

/** The operations that find layers and say where they are: selection, view, search, outline, the file's map and flows. */
export const NAVIGATION_OPERATIONS = {
  ping: {
    input: z.unknown(),
    output: z.object({ pong: z.literal(true) }),
  },
  selection: {
    input: z.unknown(),
    output: z.object({ nodes: z.array(NodeRefSchema) }),
  },
  show: {
    input: z.object({
      node: NodeIdSchema.exactOptional(),
      /** Several layers, all on one page: the view fits them all. */
      nodes: z.array(NodeIdSchema).min(1).max(50).exactOptional(),
      /** Fit the layers in view, or this zoom (1 is 100%) centred on them. */
      zoom: z.union([z.literal("fit"), z.number().min(0.01).max(256)]).default("fit"),
      /** Select them too, or only bring them into view. */
      select: z.boolean().default(true),
    }),
    output: z.object({
      nodes: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        }),
      ),
      page: z.string(),
      zoom: z.number(),
    }),
  },
  selection_wait: {
    input: z.object({
      timeoutMs: z.number().int().min(1).max(SELECTION_WAIT_MAX_MS),
      /** The selection the wait started from (ids): a later round keeps the first one's. Null: the selection now. */
      from: z.array(z.string()).nullable(),
    }),
    output: z.object({
      changed: z.boolean(),
      from: z.array(z.string()),
      nodes: z.array(NodeRefSchema),
    }),
  },
  changes: {
    input: z.object({
      /** The cursor of an earlier answer: only what changed after it. Default: everything the plugin has seen. */
      since: z.number().int().min(0).exactOptional(),
    }),
    output: z.object({
      cursor: z.number().int(),
      /** When the plugin started watching: its window opened. */
      since: z.string(),
      /** Older changes than the cursor asked for were dropped: the journal keeps the latest only. */
      truncated: z.boolean(),
      changes: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          change: z.enum(["created", "deleted", "changed"]),
          properties: z.array(z.string()),
          by: z.enum(["user", "collaborator", "pixelwright"]),
          page: z.string(),
          at: z.string(),
        }),
      ),
    }),
  },
  file_map: {
    input: z.null(),
    output: z.object({
      pages: z.array(
        LayerNameSchema.extend({
          current: z.boolean(),
          /** How many top layers the page has, when not all are listed. */
          total: z.number().int().exactOptional(),
          /** The page's top layers (frames, sections, components), a section's own listed inside it. */
          nodes: z.array(
            MapNodeSchema.extend({
              children: z.array(MapNodeSchema).exactOptional(),
            }),
          ),
        }),
      ),
      /** Pages left out: the operation's time ran out, read them with outline. */
      more: z.boolean(),
    }),
  },
  screens: {
    input: z.object({ node: NodeIdSchema }),
    output: ScreensRawSchema,
  },
  set_of: {
    input: z.object({ node: NodeIdSchema }),
    /** The component set the node is, or holds a variant of, or is an instance of a variant of. */
    output: LayerNameSchema,
  },
  usage: {
    input: z.object({
      /** A style's or variable's token as design_read and tokens_read write it (--White-2, --h1-font). */
      token: z.string().min(3).max(300),
      /** The layer or page to look in, or "file" for every page. Default: the current page. */
      within: z.union([z.literal("file"), NodeIdSchema]).exactOptional(),
    }),
    output: z.object({
      token: z.string(),
      kind: z.enum(["paint style", "text style", "effect style", "variable"]),
      name: z.string(),
      layers: z.array(
        LayerNameSchema.extend({
          type: z.string(),
          property: z.string().describe("Where the layer uses it: fill, stroke, effect, text, a text run, or a field."),
        }),
      ),
      more: z.boolean(),
    }),
  },
  flows: {
    input: z.object({
      /** The page to map. Default: the current page. */
      page: NodeIdSchema.exactOptional(),
    }),
    output: z.object({
      page: z.string(),
      /** The page's flow starting points, by their names. */
      starts: z.array(LayerNameSchema),
      /** The page's frames, and those inside its sections: the screens a prototype moves between. */
      screens: z.array(
        LayerNameSchema.extend({
          width: z.number(),
          height: z.number(),
        }),
      ),
      /** Each interaction that leaves its layer: from which screen and layer, on what, to where, and how. */
      links: z.array(
        z.object({
          from: LayerNameSchema,
          layer: LayerNameSchema,
          trigger: z.string(),
          action: z.string(),
          to: LayerNameSchema.nullable(),
          url: z.string().exactOptional(),
          summary: z.string(),
        }),
      ),
      more: z.boolean(),
    }),
  },
  viewport: {
    input: z.null(),
    output: z.object({
      page: z.string(),
      zoom: z.number(),
      center: z.object({
        x: z.number(),
        y: z.number(),
      }),
      /** The part of the page in view, in page px. */
      bounds: BoxSchema,
      /** The page's layers and their children that meet the view, outermost first. */
      layers: z.array(NodeRefSchema),
      more: z.boolean(),
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
} as const;
