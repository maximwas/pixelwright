import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const InspectInputSchema = z.object({
  nodes: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(100)
    .exactOptional()
    .describe('The layers\' ids, e.g. ["54:243"]. Default: the layers selected in Figma.'),
  relativeTo: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("A layer (a section, a frame) whose top left the boxes are measured from. Default: the page's."),
  around: z
    .union([
      z.string().min(1).max(200),
      z.object({
        x: z.number(),
        y: z.number(),
      }),
    ])
    .exactOptional()
    .describe(
      "A point to measure each layer's distance and angle from: a layer's id (its centre, e.g. a ring's), or {x, y} in the boxes' origin (relativeTo's top left, or the page's). The angle matches CSS rotate(): 0 straight up, then clockwise to 360.",
    ),
  file: FileSchema,
});
