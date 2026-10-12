import * as z from "zod";

const GlobsSchema = z.array(z.string()).optional();

/** figma.config.json as far as Pixelwright reads it: which files hold templates (also accepted at the top level). */
export const FigmaConfigSchema = z.looseObject({
  codeConnect: z
    .looseObject({
      include: GlobsSchema,
      exclude: GlobsSchema,
    })
    .optional(),
  include: GlobsSchema,
  exclude: GlobsSchema,
});
