import * as z from "zod";
import { BASELINE_NAME } from "./constants.ts";

/** A layer or page by id and name. */
export const NamedSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** The layer a baseline holds. */
export const BaselineNodeSchema = NamedSchema.extend({ type: z.string() });

/** The Figma file a baseline came from: its name, and its key when Figma gives one. */
export const BaselineFigmaFileSchema = z.object({
  name: z.string(),
  key: z.string().nullable(),
});

/** How many entries each list of a diff holds. */
export const CountsSchema = z.object({
  changed: z.number(),
  added: z.number(),
  removed: z.number(),
  moved: z.number(),
  reordered: z.number(),
  components: z.number(),
  tokens: z.number(),
});

/** A baseline's name, as the tools take it. */
export const BaselineNameSchema = z.string().min(1).max(64).regex(BASELINE_NAME);
