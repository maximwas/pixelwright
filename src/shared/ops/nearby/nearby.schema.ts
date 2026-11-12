import * as zod from "zod/mini";
import { NEARBY, NEARBY_FIELD, NOTE_SIDE } from "@/shared/ops/nearby/nearby.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** The notes around the screen holding a layer, within `distance` px of it. */
export const NearbyOpInputSchema = zod.strictObject({
  node: NodeIdSchema,
  distance: zod.int().check(zod.minimum(0), zod.maximum(NEARBY.maxDistance)),
});

const NearbyNoteSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  text: zod.string().check(zod.describe(NEARBY_FIELD.text)),
  side: zod.enum(NOTE_SIDE).check(zod.describe(NEARBY_FIELD.side)),
  distance: zod.number().check(zod.describe(NEARBY_FIELD.distance)),
});

/** The screen the layer is on, the notes around it nearest first, and how many more. */
export const NearbyOpOutputSchema = zod.object({
  screen: zod.object({ id: zod.string(), name: zod.string() }),
  notes: zod.array(NearbyNoteSchema),
  more: zod.int(),
});

export type NearbyNote = zod.output<typeof NearbyNoteSchema>;

export type NearbyNotesOutput = zod.output<typeof NearbyOpOutputSchema>;
