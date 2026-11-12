import type * as z from "zod";
import type { MeasuredPairSchema, MeasureSchema } from "../schemas/measure.ts";
import type { InspectBox } from "./inspect.ts";

export type Measure = z.output<typeof MeasureSchema>;
export type MeasuredPair = z.output<typeof MeasuredPairSchema>;

/** A layer to measure: its id, name, layout box and painted box (null when Figma gives none). */
export interface MeasuredLayer {
  readonly id: string;
  readonly name: string;
  readonly box: InspectBox;
  readonly paintedBox: InspectBox | null;
}

/** A Dev Mode measurement as design_read gives it: each end as "<id> <side>", and the distance when both are read. */
export interface MeasurementView {
  readonly from: string;
  readonly to: string;
  readonly px?: number;
  readonly text?: string;
}
