import * as z from "zod";
import { ApplyChangeSchema, ApplyResultSchema, EntriesSchema } from "../apply/schemas.ts";
import { EXPORT_CHUNK_BYTES, UPLOAD_MAX_BYTES, VERSION_DESCRIPTION_CHARS } from "../constants/bridge.ts";
import { EXECUTE_CODE_CHARS, EXECUTE_MAX_MS } from "../constants/execute.ts";
import { InstancesInputSchema, InstancesOutputSchema } from "../instances/schemas.ts";
import { TextsInputSchema, TextsOutputSchema } from "../texts/schemas.ts";
import { BindInputSchema, BindOutputSchema } from "../tokens/bind/schemas.ts";
import { TokensApplyResultSchema, TokensPlanSchema } from "../tokens/plan/schemas.ts";
import { RawTokensSchema } from "../tokens/raw-tokens.ts";
import { EffectsInputSchema, EffectsOutputSchema } from "./effects.ts";
import { InspectRawSchema } from "./inspect.ts";
import { ComponentEntrySchema, NodeIdSchema, QuerySchema } from "./operation-shapes.ts";
import { SnapshotSchema } from "./snapshot.ts";

/** The operations that read layers' content and tokens, export them, and write: apply, tokens, execute, delete. */
export const CONTENT_OPERATIONS = {
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
      /** Variable modes to render in, by collection and mode name: set on the layer for the render, then set back. */
      modes: z.record(z.string().min(1).max(200), z.string().min(1).max(200)).exactOptional(),
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
      /** Also read the links people attached in Dev Mode (Figma's servers, paid plans only). */
      links: z.boolean().default(false),
    }),
    output: z.object({
      components: z.array(ComponentEntrySchema),
      more: z.boolean(),
      /** Links were asked for and this plugin reads them: an older plugin leaves it out. */
      linksRead: z.literal(true).exactOptional(),
      /** Why some or all links were not read: Figma refused them, gave no answer, or the time ran out. */
      linksNote: z.string().exactOptional(),
      /** Pages Figma could not load (offline, say), with its words: their components are not listed. */
      pagesNotRead: z
        .array(
          z.object({
            name: z.string(),
            error: z.string(),
          }),
        )
        .exactOptional(),
    }),
  },
  variables: {
    input: z.object({
      /** Also list the enabled libraries' variables (by name: their values need an import). */
      libraries: z.boolean().default(false),
      /**
       * Also take the styles and variables the layers in `within` (or the current page) use, wherever they come from:
       * a file that uses a team library has its tokens there, not among its own.
       */
      used: z.boolean().default(true),
      within: NodeIdSchema.exactOptional(),
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
      /** Hash each vector's paths (pathHash), for comparing drawings: nodes_diff and variants_read ask for it. */
      paths: z.boolean().default(false),
    }),
    output: SnapshotSchema,
  },
  entries: {
    input: z.object({
      /** The layers design_apply changes; each comes back with its parent, as design_read would see them. */
      ids: z.array(NodeIdSchema).max(10_000),
    }),
    output: EntriesSchema,
  },
  apply: {
    input: z.object({
      /** In the XML's order: a parent before its children. */
      changes: z.array(ApplyChangeSchema).max(10_000),
      /** Where top-level creates go; the current page when left out. */
      parent: NodeIdSchema.exactOptional(),
      /** Check ids, parents, tokens and fonts without changing anything (works with Allow edits off). */
      dryRun: z.boolean().default(false),
    }),
    output: ApplyResultSchema,
  },
  upload: {
    input: z.object({
      /** A fresh id for one file; apply names it where the file's bytes are needed. */
      stream: z.string().min(1).max(64),
      offset: z.number().int().min(0),
      /** Base64, at most UPLOAD_CHUNK_BYTES raw bytes. */
      chunk: z.string().max(4 * 1024 * 1024),
      total: z.number().int().min(1).max(UPLOAD_MAX_BYTES),
    }),
    output: z.object({ received: z.number().int() }),
  },
  /** A named version in the file's history, saved before a write for the designer to go back to. */
  save_version: {
    input: z.object({
      title: z.string().min(1).max(100),
      /** Shown under the title; plugins before stage 11 drop it. */
      description: z.string().min(1).max(VERSION_DESCRIPTION_CHARS).exactOptional(),
    }),
    /** The description comes back when the plugin passed it on: an older one saves the title only. */
    output: z.object({
      id: z.string().nullable(),
      description: z.string().exactOptional(),
    }),
  },
  /** Variables and styles written by name, as tokens_apply planned them; a dry run only checks. */
  tokens_apply: {
    input: z.object({
      plan: TokensPlanSchema,
      dryRun: z.boolean(),
    }),
    output: TokensApplyResultSchema,
  },
  /** Raw values bound to the tokens that hold them, or one token's uses rebound to another; a dry run only finds. */
  bind: {
    input: BindInputSchema,
    output: BindOutputSchema,
  },
  /** Find and replace in the texts under layers or pages, each run's style kept; a dry run only finds. */
  texts: {
    input: TextsInputSchema,
    output: TextsOutputSchema,
  },
  /** Detached frames put back as instances, instances swapped, overrides taken off; a dry run only finds. */
  instances: {
    input: InstancesInputSchema,
    output: InstancesOutputSchema,
  },
  /** Code run in the plugin: its value made JSON-safe, what it printed, and what it threw or that it ran too long. */
  execute: {
    input: z.object({
      code: z.string().min(1).max(EXECUTE_CODE_CHARS),
      timeoutMs: z.number().int().min(1).max(EXECUTE_MAX_MS),
    }),
    output: z.object({
      result: z.unknown(),
      logs: z.array(z.string()),
      error: z.string().exactOptional(),
    }),
  },
  /** Layers as Figma has them, from `relativeTo`'s top left (the page's without it): read only, Allow edits or not. */
  inspect: {
    input: z.object({
      nodes: z.array(NodeIdSchema).min(1).max(100),
      relativeTo: NodeIdSchema.exactOptional(),
    }),
    output: InspectRawSchema,
  },
  /**
   * The smallest layer that renders a region of a layer as the layer's own render shows it: the deepest opaque one
   * holding the region with nothing painted over it, else the layer itself. Read only.
   */
  cover: {
    input: z.object({
      node: NodeIdSchema,
      /** The region, from the layer's box top left, in px. */
      clip: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      }),
    }),
    output: z.object({
      node: z.string(),
      /** Its box, from the layer's box top left. */
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  },
  /** Figma's own noise, texture and glass on layers: write, refused while Allow edits is off (dryRun is not). */
  effects: {
    input: EffectsInputSchema,
    output: EffectsOutputSchema,
  },
  delete: {
    input: z.object({
      nodes: z.array(NodeIdSchema).min(1).max(500),
    }),
    output: z.object({
      deleted: z.array(z.string()),
      /** Layers that stay, with why. */
      errors: z.array(
        z.object({
          id: z.string(),
          message: z.string(),
        }),
      ),
    }),
  },
} as const;
