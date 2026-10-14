import * as z from "zod";
import type { FigmaProps, TextRunSpec } from "../css-mapping/figma-props.ts";
import type { ApplyChange, ApplyError } from "../types/apply.ts";
import { SnapshotNodeSchema, SnapshotSchema } from "./snapshot.ts";

const RefSchema = z.string().min(1).max(200);

/** Core's own translation, checked for its shape only: the plugin sets each property in its own try. */
const PropsSchema = z.custom<FigmaProps>(
  (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  "props must be an object",
);

const RunSchema: z.ZodType<TextRunSpec, TextRunSpec> = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  props: PropsSchema,
});

export const ApplyChangeSchema: z.ZodType<ApplyChange, ApplyChange> = z.object({
  line: z.number().int(),
  column: z.number().int(),
  kind: z.enum(["create", "update"]),
  ref: RefSchema,
  id: RefSchema.nullable(),
  tag: z.string().min(1).max(50),
  parent: RefSchema.nullable(),
  index: z.number().int().min(0),
  before: RefSchema.exactOptional(),
  after: RefSchema.exactOptional(),
  props: PropsSchema,
  sources: z.record(z.string(), z.string()),
  text: z
    .object({
      characters: z.string().max(1_000_000),
      runs: z.array(RunSchema),
    })
    .exactOptional(),
  copyOf: RefSchema.exactOptional(),
  source: RefSchema.exactOptional(),
  copy: RefSchema.exactOptional(),
  move: z.boolean().exactOptional(),
});

export const ApplyErrorSchema: z.ZodType<ApplyError, ApplyError> = z.object({
  line: z.number().int(),
  column: z.number().int(),
  id: z.string().exactOptional(),
  attribute: z.string().exactOptional(),
  message: z.string(),
  hint: z.string().exactOptional(),
});

export const ApplyResultSchema = z.object({
  /** The layers made, by their element's line and temporary ref. */
  created: z.array(
    z.object({
      line: z.number().int(),
      ref: z.string(),
      id: z.string(),
      tag: z.string(),
    }),
  ),
  /** The existing layers written to. */
  changed: z.array(z.string()),
  errors: z.array(ApplyErrorSchema),
});

/**
 * The layers design_apply changes as design_read sees them: each one asked for that is not inside another one asked
 * for, with its descendants and its parent's own entry, all from one origin so they place each other as a read does.
 */
export const EntriesSchema = SnapshotSchema.omit({ root: true }).extend({
  roots: z.array(
    z.object({
      node: SnapshotNodeSchema,
      parent: SnapshotNodeSchema.nullable(),
    }),
  ),
  /** Asked for but not found, or not a layer. */
  missing: z.array(z.string()),
});
