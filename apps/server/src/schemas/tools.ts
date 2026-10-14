import {
  ApplyErrorSchema,
  ApplyResultSchema,
  DesignDiffSchema,
  EXECUTE_CODE_CHARS,
  EXECUTE_DEFAULT_MS,
  EXECUTE_MAX_MS,
  OPERATION_SCHEMAS,
  TokensApplyInputSchema,
  TokensApplyResultSchema,
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
  node: z.string().min(1).max(200).describe("The layer's id, e.g. 54:243."),
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
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .exactOptional()
    .describe(
      "Only this region of the layer, in Figma px from its box's top left (before scale); with effects on it may reach into what paints around the box.",
    ),
  modes: OPERATION_SCHEMAS.export.input.shape.modes.describe(
    'Render in these variable modes, by collection and mode name, e.g. {"Theme": "Dark"}: set on the layer for the render, then set back (needs Allow edits; the file is left as it was).',
  ),
  file: FileSchema,
});

export const DesignReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer's id, e.g. 54:243. Default: the one layer selected in Figma."),
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
  code: z
    .boolean()
    .default(true)
    .describe(
      "Run the project's Code Connect templates, giving connected instances as $code with their code (default); false reads them as layers.",
    ),
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
  format: z
    .enum(["PNG", "JPG", "WEBP", "SVG", "PDF"])
    .exactOptional()
    .describe("For nodes: the format of every file. WEBP is rendered as PNG by Figma and encoded here."),
  scale: z
    .number()
    .min(0.01)
    .max(4)
    .exactOptional()
    .describe("For PNG, JPG and WEBP: pixels per Figma pixel, or per CSS px with width. Default 2."),
  width: z
    .number()
    .positive()
    .max(16_384)
    .exactOptional()
    .describe(
      "For nodes as PNG, JPG or WEBP: the CSS width the build shows the layer at; the file is width × scale px wide (110 at scale 2: 220 px).",
    ),
  quality: z.number().int().min(1).max(100).exactOptional().describe("For WEBP: 1 to 100. Default 85."),
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
      planned: z
        .string()
        .exactOptional()
        .describe("The path design_read plans for this layer, when the file got another name: use path in its src."),
      bytes: z.number(),
    }),
  ),
  notes: z.array(z.string()),
  errors: z.array(
    z.object({
      node: z.string(),
      message: z.string(),
    }),
  ),
});

/** The name of a version a write saves in the file's history first, for design_apply and tokens_apply. */
const VersionInputSchema = z
  .string()
  .min(1)
  .max(100)
  .exactOptional()
  .describe(
    "A name for a version saved in the file's history before writing, for the designer to go back to (not in a dry run). Pass one before a write that changes many layers or tokens.",
  );

/** The version a write saved, as its result gives it. */
const VersionSavedSchema = z
  .object({
    id: z.string().nullable(),
    title: z.string(),
  })
  .exactOptional();

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
  version: VersionInputSchema,
  file: FileSchema,
});

export const DesignApplyOutputSchema = ApplyResultSchema.extend({
  errors: z.array(ApplyErrorSchema),
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
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

export const TokensApplyToolInputSchema = TokensApplyInputSchema.extend({
  dryRun: z
    .boolean()
    .default(false)
    .describe("Check names, types, modes and aliases without writing; works with Allow edits off."),
  version: VersionInputSchema,
  file: FileSchema,
});

export const TokensApplyOutputSchema = TokensApplyResultSchema.extend({
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
});

export const CodeConnectReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("A layer or page id to look in, e.g. 54:243. Default: the current page."),
  file: FileSchema,
});

const ComponentCountSchema = z.object({
  component: z.string().describe("The Figma component's (or component set's) name."),
  instances: z.number(),
});

export const CodeConnectReadOutputSchema = z.object({
  root: z.string().describe("The project folder the templates were looked for in."),
  templates: z.array(
    z.object({
      path: z.string(),
      url: z.string().optional(),
      component: z.string().optional(),
      matches: z.array(ComponentCountSchema),
      error: z.string().optional().describe("What a trial run on the first instance it matches gave."),
    }),
  ),
  unconnected: z.array(ComponentCountSchema).describe("Components used here that no template connects."),
  problems: z.array(z.string()),
});

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
  file: FileSchema,
});

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

const EdgeDiffSchema = z.object({
  matched: z.number(),
  shifted: z.array(
    z.object({
      reference: z.number(),
      node: z.number(),
      by: z.number(),
    }),
  ),
  missing: z.array(z.number()),
  extra: z.array(z.number()),
});

export const ImageCompareInputSchema = z.object({
  node: z.string().min(1).max(200).describe("The layer's id, e.g. 54:243."),
  reference: z
    .string()
    .min(1)
    .max(4_096)
    .describe(
      "The PNG to compare with, e.g. a screenshot of your build at the same size: a path, relative to the server's folder or absolute.",
    ),
  scale: z
    .number()
    .min(0.01)
    .max(4)
    .default(1)
    .describe("Pixels per Figma pixel of the render: the reference's density."),
  effects: z
    .boolean()
    .default(true)
    .describe("Render shadows and outside strokes around the layer; false renders only its own box."),
  clip: ScreenshotInputSchema.shape.clip,
  modes: ScreenshotInputSchema.shape.modes,
  diff: z
    .string()
    .min(1)
    .max(4_096)
    .exactOptional()
    .describe("A .png path to write the difference to: the render faded, every differing pixel red."),
  file: FileSchema,
});

export const ImageCompareOutputSchema = z.object({
  size: z.object({
    node: z.string(),
    reference: z.string(),
  }),
  scale: z.number(),
  rmse: z.number().describe("Root mean square colour difference, 0 to 255, both images over white."),
  different: z.number().describe("The share of pixels that differ by more than antialiasing does, 0 to 1."),
  box: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable()
    .describe("The box around every differing pixel, in px of the render; null when none differs."),
  rows: EdgeDiffSchema.describe(
    "Horizontal edges by y: matched, shifted (by: + is lower in the render), missing, extra.",
  ),
  columns: EdgeDiffSchema.describe("Vertical edges by x: matched, shifted (by: + is further right in the render)."),
  diff: z.string().exactOptional(),
  note: z.string().exactOptional(),
});

export const MeasureInputSchema = z.object({
  nodes: z
    .array(z.string().min(1).max(200))
    .min(2)
    .max(100)
    .exactOptional()
    .describe(
      'The layers\' ids in the order to measure, each from the one before, e.g. ["54:244", "54:268"]. Default: the layers selected in Figma.',
    ),
  painted: z
    .boolean()
    .default(false)
    .describe("Measure what is painted (centred or outside strokes, shadows, blur) instead of the layout boxes."),
  file: FileSchema,
});

export const SelectionWaitInputSchema = z.object({
  timeout: z
    .number()
    .min(1)
    .max(300)
    .default(60)
    .describe("Seconds to wait for the user to select something: 60 by default, 300 at most."),
  file: FileSchema,
});

export const SelectionWaitOutputSchema = z.object({
  changed: z.boolean().describe("Whether the user selected something else before the time ran out."),
  nodes: OPERATION_SCHEMAS.selection.output.shape.nodes.describe("The selection now."),
});

export const ChangesSinceInputSchema = z.object({
  cursor: z
    .number()
    .int()
    .min(0)
    .exactOptional()
    .describe("The cursor an earlier answer gave: only what changed after it. Default: all the plugin has seen."),
  file: FileSchema,
});

export const ContrastInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer whose texts to check (a section, a screen). Default: the one layer selected in Figma."),
  file: FileSchema,
});

export const TokensUsageInputSchema = z.object({
  token: OPERATION_SCHEMAS.usage.input.shape.token.describe(
    "A style's or variable's token as design_read or tokens_read writes it: --White-2, --h1-font, --color-bg.",
  ),
  within: OPERATION_SCHEMAS.usage.input.shape.within.describe(
    "The layer or page to look in. Default: the current page.",
  ),
  file: FileSchema,
});

export const VariantsInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .describe("A component set's id, or one of its variants', or an instance's: its set is read."),
  file: FileSchema,
});

export const BreakpointsInputSchema = z.object({
  node: z.string().min(1).max(200).describe("A screen's id, or a layer's on it."),
  file: FileSchema,
});

export const FontsCheckInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer whose texts' fonts to check (a section, a screen). Default: the one layer selected in Figma."),
  file: FileSchema,
});

export const FontsCheckOutputSchema = z.object({
  summary: z.string(),
  fonts: z.array(
    z.object({
      family: z.string(),
      weights: z.array(z.string()).describe('The weights used, "400 italic" for an italic.'),
      google: z
        .boolean()
        .nullable()
        .describe("Whether Google Fonts serves the family; null when it could not be reached."),
      css: z.string().exactOptional().describe("The Google Fonts css2 link for the weights used."),
      note: z.string().exactOptional(),
    }),
  ),
});

export const AuditInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer to audit (a screen, a section). Default: the one layer selected in Figma."),
  file: FileSchema,
});
