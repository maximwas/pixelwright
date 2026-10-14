import * as z from "zod";
import {
  BaselineFigmaFileSchema,
  BaselineNameSchema,
  BaselineNodeSchema,
  CountsSchema,
  NamedSchema,
} from "../../baselines/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";

export const BaselineSaveInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe(
      "The layer the code is built from: a frame, section, component or instance. Default: the one selected layer. Not with accept.",
    ),
  name: BaselineNameSchema.exactOptional().describe(
    "Named after the code: pricing, plan-card. Default: the layer's name as a slug. Required with accept.",
  ),
  code: z
    .array(z.string().min(1).max(300))
    .max(50)
    .exactOptional()
    .describe(
      "The project's files built from the layer, relative to the project. Default: the list the baseline already has.",
    ),
  accept: z
    .string()
    .regex(/^[0-9a-f]{16}$/)
    .exactOptional()
    .describe("The accept a baseline_diff answer gave: keeps exactly the design that diff compared."),
  replace: z
    .boolean()
    .default(false)
    .describe("Start the named baseline over from the layer as it is now. Not with accept."),
  file: FileSchema,
});

export const BaselineSaveOutputSchema = z.object({
  name: z.string(),
  path: z.string().describe("The baseline's file, absolute."),
  node: BaselineNodeSchema,
  file: BaselineFigmaFileSchema,
  page: NamedSchema.nullable().describe("Null from a plugin older than this server."),
  capturedAt: z.string().describe("When the design it keeps was read (the diff's read, with accept)."),
  code: z.array(z.string()),
  layers: z.number().describe("Layers read."),
  tokens: z.number().describe("Variables and styles kept with their values in every mode."),
  cut: z
    .array(
      NamedSchema.extend({
        children: z.number(),
      }),
    )
    .describe("Branches the read did not hold whole: baseline_diff does not compare inside them."),
  replaced: z
    .object({
      node: NamedSchema,
      capturedAt: z.string(),
      counts: CountsSchema,
    })
    .exactOptional()
    .describe("With replace: what the baseline it replaced kept, and how much the new read took in."),
  notes: z.array(z.string()),
});
