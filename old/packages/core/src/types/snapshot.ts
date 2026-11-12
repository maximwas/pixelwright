import type * as z from "zod";
import type { SnapshotSchema, SnapshotStyleSchema, SnapshotVariableSchema } from "../schemas/snapshot.ts";
import type { SnapshotFieldsSchema } from "../schemas/snapshot-fields.ts";
import type { TextSegmentSchema } from "../schemas/snapshot-text.ts";
import type { EffectSchema, PaintSchema, ReactionSchema } from "../schemas/snapshot-values.ts";

/** A snapshot node with its children (SnapshotNodeSchema): zod cannot infer the recursive type itself. */
export interface SnapshotNode extends z.output<typeof SnapshotFieldsSchema> {
  children?: SnapshotNode[] | undefined;
}

export type Snapshot = z.output<typeof SnapshotSchema>;
export type SnapshotStyle = z.output<typeof SnapshotStyleSchema>;
export type SnapshotVariable = z.output<typeof SnapshotVariableSchema>;
export type SnapshotPaint = z.output<typeof PaintSchema>;
export type SnapshotEffect = z.output<typeof EffectSchema>;
export type SnapshotReaction = z.output<typeof ReactionSchema>;
export type TextSegment = z.output<typeof TextSegmentSchema>;
