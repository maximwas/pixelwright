import type * as z from "zod";
import type {
  EffectSchema,
  PaintSchema,
  SnapshotFieldsSchema,
  SnapshotSchema,
  SnapshotStyleSchema,
  SnapshotVariableSchema,
  TextSegmentSchema,
} from "../schemas/snapshot.ts";

/** A snapshot node with its children (SnapshotNodeSchema): zod cannot infer the recursive type itself. */
export interface SnapshotNode extends z.output<typeof SnapshotFieldsSchema> {
  children?: SnapshotNode[] | undefined;
}

export type Snapshot = z.output<typeof SnapshotSchema>;
export type SnapshotStyle = z.output<typeof SnapshotStyleSchema>;
export type SnapshotVariable = z.output<typeof SnapshotVariableSchema>;
export type SnapshotPaint = z.output<typeof PaintSchema>;
export type SnapshotEffect = z.output<typeof EffectSchema>;
export type TextSegment = z.output<typeof TextSegmentSchema>;
