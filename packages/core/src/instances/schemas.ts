import * as z from "zod";
import { NodeIdSchema } from "../schemas/operation-shapes.ts";

/** A component or component set by its name, its id, or `key:<key>` for a library's. */
const ComponentNameSchema = z.string().min(1).max(300);

/** Instances of one component become instances of another (a set's matching variant, else its default). */
export const InstanceSwapSchema = z.object({
  from: ComponentNameSchema,
  to: ComponentNameSchema,
});

/** The `instances` operation: detached frames put back as instances, instances swapped, overrides taken off. */
export const InstancesInputSchema = z.object({
  /** Where to look: layers or pages (the roots themselves included). */
  roots: z.array(NodeIdSchema).min(1).max(200),
  /** Put each frame detached from a component back as an instance of it. */
  reattach: z.boolean().default(false),
  swap: z.array(InstanceSwapSchema).max(50).default([]),
  /** Take overrides off instances: their look only (fills, strokes, radii, effects…, texts kept), or all of them. */
  reset: z.enum(["look", "all"]).exactOptional(),
  /** Find what would change without writing (works with Allow edits off). */
  dryRun: z.boolean().default(false),
});

export const InstancesOutputSchema = z.object({
  reattached: z.array(
    z.object({
      frame: z.string().describe("The detached frame's id (gone after a real run)."),
      name: z.string(),
      instance: z.string().nullable().describe("The new instance's id; null in a dry run."),
      component: z.string(),
      kept: z
        .array(z.string())
        .describe("What the frame had that the instance now has too: texts, images, hidden layers."),
      lost: z.array(z.string()).describe("Layers only the frame had: the instance has nowhere to put them."),
    }),
  ),
  swapped: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      from: z.string(),
      to: z.string(),
    }),
  ),
  reset: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      fields: z.array(z.string()),
    }),
  ),
  errors: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
    }),
  ),
  notes: z.array(z.string()),
  /** The time ran out before every layer: run again with narrower roots. */
  more: z.boolean(),
});

export type InstancesInput = z.output<typeof InstancesInputSchema>;

export type InstancesOutput = z.output<typeof InstancesOutputSchema>;
