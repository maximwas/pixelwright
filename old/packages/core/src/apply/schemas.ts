import * as z from "zod";
import type { FigmaProps, TextRunSpec } from "../css-mapping/figma-props.ts";
import { SnapshotNodeSchema, SnapshotSchema } from "../schemas/snapshot.ts";
import type { ApplyChange, ApplyError } from "./types.ts";

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
  /**
   * The layers made, by their element's line and temporary ref, with their names; a dry run's, which it would make,
   * have no id and no name.
   */
  created: z.array(
    z.object({
      line: z.number().int(),
      ref: z.string(),
      id: z.string().exactOptional(),
      tag: z.string(),
      name: z.string().exactOptional(),
    }),
  ),
  /** The existing layers written to (a dry run's: would be), and the layers of a copy or new instance written. */
  changed: z.array(z.string()),
  errors: z.array(ApplyErrorSchema),
  /**
   * The properties prop, visibleProp and swapProp added to components that were there before the call (a dry run's:
   * would add), each on its component or set by id, by name without Figma's #id; left out when none.
   */
  properties: z
    .array(
      z.object({
        component: z.string(),
        name: z.string(),
        type: z.enum(["TEXT", "BOOLEAN", "INSTANCE_SWAP"]),
      }),
    )
    .exactOptional(),
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
      /** The page a root without a parent layer sits on: a <Page> element holding it keeps it there. */
      page: z.string().exactOptional(),
    }),
  ),
  /** Asked for but not found, or not a layer. */
  missing: z.array(z.string()),
});

/** The layers design_apply reads before it writes, as the plugin answers. */
export type EntriesRead = z.output<typeof EntriesSchema>;
