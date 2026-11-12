import * as zod from "zod/mini";
import { BASELINE_FILES } from "@/server/app/baselines/baselines.constants.ts";
import { RawTokensSchema } from "@/shared/ops/variables/variables.schema.ts";
import { ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

/** A layer or a page by id and name. */
export const NamedSchema = zod.object({ id: zod.string(), name: zod.string() });

/** The layer a baseline keeps. */
export const BaselineNodeSchema = zod.extend(NamedSchema, { type: zod.string() });

/** A baseline's name as the tools take it: lowercase words joined by hyphens, 1 to 64 characters. */
export const BaselineNameSchema = zod
  .string()
  .check(zod.minLength(BASELINE_FILES.minName), zod.maxLength(BASELINE_FILES.maxName), zod.regex(BASELINE_FILES.name));

/** The Figma version 0.7.0's version_save recorded with a baseline. */
export const BaselineVersionSchema = zod.object({
  id: zod.nullable(zod.string()),
  title: zod.string(),
  savedAt: zod.string(),
});

/** The Figma file a baseline came from: its name, and its key when Figma gives one. */
export const BaselineFigmaFileSchema = zod.object({ name: zod.string(), key: zod.nullable(zod.string()) });

/** A baseline file, format 1 as 0.7.0 wrote it (K-058, D-33): its header, then a layer's read and the tokens it uses. */
export const BaselineFileSchema = zod.object({
  pixelwrightBaseline: zod.literal(BASELINE_FILES.format),
  /** The file's name, which wins when they differ. */
  name: zod.string(),
  /** When the layer was read: an ISO time. */
  capturedAt: zod.string(),
  /** The versions that read it. */
  by: zod.object({ server: zod.string(), plugin: zod.nullable(zod.string()) }),
  file: BaselineFigmaFileSchema,
  page: zod.nullable(NamedSchema),
  node: BaselineNodeSchema,
  /** The project's files built from the layer, relative to the project. */
  code: zod.array(zod.string()),
  /** The Figma version 0.7.0's version_save recorded with it. */
  version: zod.nullable(BaselineVersionSchema),
  /** A read model; a 0.7.0 snapshot has no header and reads as a design model. */
  snapshot: ReadModelSchema,
  /** The tokens the read uses, with every mode; null when they could not be read. */
  tokens: zod.nullable(RawTokensSchema),
});

export type BaselineFile = zod.output<typeof BaselineFileSchema>;
