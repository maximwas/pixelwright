import {
  ApplyErrorSchema,
  ApplyResultSchema,
  EXECUTE_CODE_CHARS,
  EXECUTE_DEFAULT_MS,
  EXECUTE_MAX_MS,
  OPERATION_SCHEMAS,
} from "@pixelwright/core";
import * as z from "zod";
import { MAX_EXPORT_NODES } from "../constants/mcp.ts";

/** Which connected file a tool works on: its session from status, or its name; the active file when left out. */
export const FileSchema = z
  .string()
  .min(1)
  .max(1_024)
  .exactOptional()
  .describe("The file to work on: its session from status or its name. Default: the active file.");

export const ScreenshotInputSchema = z.object({
  node: z.string().min(1).max(200).describe("The layer's id, e.g. 2:4868."),
  scale: z.number().min(0.01).max(4).default(1).describe("Pixels per Figma pixel: 2 for a sharp look, below 1 to fit."),
  effects: z
    .boolean()
    .default(true)
    .describe("Include shadows and outside strokes around the layer; false renders only its own box."),
  save: z
    .string()
    .min(1)
    .max(4_096)
    .exactOptional()
    .describe(
      "Write the PNG to this file (any size) instead of returning it; a relative path is from the server's folder.",
    ),
  file: FileSchema,
});

export const DesignReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer's id, e.g. 2:4868. Default: the one layer selected in Figma."),
  depth: z.number().int().min(0).max(100).exactOptional().describe("Levels below the layer to read. Default: all."),
  assetsDir: z
    .string()
    .min(1)
    .max(4_096)
    .exactOptional()
    .describe(
      "Folder to write the icons (SVG) and images (PNG at 2x, originals for backgrounds) into, e.g. src/assets; the XML's src paths start with it. Without it the assets are only planned.",
    ),
  screenshot: z.boolean().default(false).describe("Also return the layer's image, to compare your build with."),
  maxChars: z
    .number()
    .int()
    .min(2_000)
    .max(400_000)
    .default(80_000)
    .describe("Longest XML to return; deeper branches past it come back empty with $truncated, to read on their own."),
  file: FileSchema,
});

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
    .enum(["css", "json"])
    .default("css")
    .describe("css: ready custom properties, a block per extra mode. json: the token model, per collection and mode."),
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
  format: z.enum(["css", "json"]),
  css: z.string().exactOptional(),
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

export const AssetsExportInputSchema = z.object({
  nodes: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(MAX_EXPORT_NODES)
    .exactOptional()
    .describe(
      "Layers to write, one file each: SVG for an icon, PNG otherwise, unless format says. Give nodes or from.",
    ),
  from: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe(
      "A layer to write every true asset of (its icons and images, as design_read plans them). Give nodes or from.",
    ),
  dir: z
    .string()
    .min(1)
    .max(4_096)
    .describe(
      "The folder to write into; created if missing. Files already there are never overwritten with other bytes.",
    ),
  format: z.enum(["PNG", "JPG", "SVG", "PDF"]).exactOptional().describe("For nodes: the format of every file."),
  scale: z.number().min(0.01).max(4).exactOptional().describe("For PNG and JPG: pixels per Figma pixel. Default 2."),
  original: z
    .boolean()
    .default(false)
    .describe(
      "Write the images as they were placed (not cropped, filtered or scaled) instead of renders, with their real format.",
    ),
  file: FileSchema,
});

export const AssetsExportOutputSchema = z.object({
  files: z.array(
    z.object({
      node: z.string(),
      kind: z.enum(["icon", "image"]),
      format: z.string(),
      path: z.string(),
      bytes: z.number(),
    }),
  ),
  errors: z.array(
    z.object({
      node: z.string(),
      message: z.string(),
    }),
  ),
});

export const DesignApplyInputSchema = z.object({
  xml: z
    .string()
    .min(1)
    .max(2_000_000)
    .describe(
      "Pixelwright XML, as design_read writes it: an element with id changes that layer (only the attributes it gives), one without id creates a layer.",
    ),
  parent: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("Where top-level new layers go: a frame's or page's id. Default: the current page, beside its layers."),
  dryRun: z
    .boolean()
    .default(false)
    .describe("Check ids, tokens and fonts without writing; works with Allow edits off."),
  file: FileSchema,
});

export const DesignApplyOutputSchema = ApplyResultSchema.extend({
  errors: z.array(ApplyErrorSchema),
  dryRun: z.boolean(),
});

export const ExecuteInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(EXECUTE_CODE_CHARS)
    .describe(
      "JavaScript run as the body of an async function with `figma` (the Plugin API) and `console`: `await` works, `return` gives the result.",
    ),
  timeout: z
    .number()
    .min(1)
    .max(EXECUTE_MAX_MS / 1_000)
    .default(EXECUTE_DEFAULT_MS / 1_000)
    .describe("Seconds to wait for the code: 10 by default, 25 at most."),
  file: FileSchema,
});

export const ExecuteOutputSchema = OPERATION_SCHEMAS.execute.output;
