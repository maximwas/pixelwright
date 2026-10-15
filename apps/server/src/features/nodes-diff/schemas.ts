import { DesignDiffSchema } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const NodesDiffInputSchema = z.object({
  a: z.string().min(1).max(200).describe("The first layer's id (variant A), e.g. 54:243."),
  b: z.string().min(1).max(200).describe("The second layer's id (variant B)."),
  depth: z.number().int().min(0).max(100).exactOptional().describe("Levels below each layer to compare. Default: all."),
  file: FileSchema,
});

export const NodesDiffOutputSchema = DesignDiffSchema.extend({
  summary: z.string(),
  more: z
    .number()
    .int()
    .exactOptional()
    .describe("Differences past the ones listed: compare smaller parts of the two layers."),
});
