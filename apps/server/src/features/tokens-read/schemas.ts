import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const TokensReadInputSchema = z.object({
  collections: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(50)
    .exactOptional()
    .describe("Only these variable collections, by name (case does not matter). Default: all of them."),
  libraries: z
    .boolean()
    .default(false)
    .describe(
      "Also list the enabled libraries' variables, by name and type: their values are read only once the file uses them.",
    ),
  used: z
    .boolean()
    .default(true)
    .describe(
      "Also take the styles and variables the layers on the current page (or within) use, a team library's among them. A file that uses a library has its tokens there.",
    ),
  within: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer or page whose used tokens to take. Default: the current page."),
  format: z
    .enum(["css", "json", "dtcg"])
    .default("css")
    .describe(
      "css: ready custom properties, a block per extra mode. json: the token model, per collection and mode. dtcg: Design Tokens Format (DTCG 2025.10) trees, one per collection mode (`<collection>.<mode>`) and one of styles, each to save as its own .json file.",
    ),
  maxChars: z
    .number()
    .int()
    .min(2_000)
    .max(400_000)
    .default(80_000)
    .describe("Longest output; past it, only the summary comes back and you read collections one at a time."),
  file: FileSchema,
});

const StyleTokenSchema = z.object({
  name: z.string(),
  token: z.string(),
  value: z.string(),
  also: z
    .array(
      z.object({
        token: z.string(),
        value: z.string(),
      }),
    )
    .exactOptional()
    .describe("A text style's letter spacing and case, as tokens of their own."),
});

const LibrarySchema = z.array(
  z.object({
    libraryName: z.string(),
    collection: z.string(),
    key: z.string(),
    variables: z.array(
      z.object({
        name: z.string(),
        key: z.string(),
        resolvedType: z.string(),
      }),
    ),
  }),
);

export const TokensReadOutputSchema = z.object({
  format: z.enum(["css", "json", "dtcg"]),
  css: z.string().exactOptional(),
  dtcg: z.record(z.string(), z.record(z.string(), z.unknown())).exactOptional(),
  summary: z
    .object({
      collections: z.array(
        z.object({
          name: z.string(),
          modes: z.array(z.string()),
          variables: z.number(),
        }),
      ),
      styles: z.object({
        paint: z.number(),
        text: z.number(),
        effect: z.number(),
      }),
    })
    .exactOptional(),
  tokens: z
    .object({
      collections: z.array(
        z.object({
          name: z.string(),
          modes: z.array(z.string()),
          defaultMode: z.string(),
          selectors: z.record(z.string(), z.string()),
          variables: z.array(
            z.object({
              name: z.string(),
              token: z.string(),
              type: z.string(),
              values: z.record(z.string(), z.string()),
              description: z.string().exactOptional(),
              scopes: z
                .array(z.string())
                .exactOptional()
                .describe("The fields Figma's pickers offer it for, when not every field: [] hides it from all."),
              codeSyntax: z
                .object({
                  WEB: z.string().exactOptional(),
                  ANDROID: z.string().exactOptional(),
                  iOS: z.string().exactOptional(),
                })
                .exactOptional(),
            }),
          ),
        }),
      ),
      styles: z.object({
        paint: z.array(StyleTokenSchema),
        text: z.array(StyleTokenSchema),
        effect: z.array(StyleTokenSchema),
      }),
    })
    .exactOptional(),
  library: LibrarySchema.exactOptional(),
  notes: z.array(z.string()),
});
