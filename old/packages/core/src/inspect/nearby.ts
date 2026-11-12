import type * as z from "zod";
import { roundTo } from "../kernel/numbers.ts";
import type { NearbyNoteSchema } from "../schemas/inspect.ts";
import type { InspectBox } from "../types/inspect.ts";
import { gapsOf } from "./measure.ts";

/** A layer on the canvas that may be a note: its box and its texts, top to bottom. */
export interface NoteCandidate {
  readonly id: string;
  readonly name: string;
  readonly box: InspectBox;
  readonly text: string;
}

export type NearbyNote = z.output<typeof NearbyNoteSchema>;

/**
 * The notes within `distance` px of a screen's box, nearest first (the canvas's order among equals): each with the
 * side it is on, over the screen when their boxes overlap, and its gap to the screen; `max` of them, and how many more.
 */
export function nearbyNotes(
  screen: InspectBox,
  candidates: readonly NoteCandidate[],
  { distance, max }: { readonly distance: number; readonly max: number },
): { notes: NearbyNote[]; more: number } {
  const notes = candidates
    .map((candidate) => noteOf(screen, candidate))
    .filter((note) => note.distance <= distance)
    .sort((a, b) => a.distance - b.distance);

  return {
    notes: notes.slice(0, max),
    more: Math.max(0, notes.length - max),
  };
}

function noteOf(screen: InspectBox, { id, name, box, text }: NoteCandidate): NearbyNote {
  const gaps = gapsOf(screen, box);

  return {
    id,
    name,
    text,
    side: sideOf(screen, box, gaps),
    distance: roundTo(Math.hypot(Math.max(0, gaps.x), Math.max(0, gaps.y)), 2),
  };
}

/**
 * The side a box is on from the screen: the axis it stands farther off on, or over the screen when they overlap on
 * both (a box touching an edge is beside it).
 */
function sideOf(
  screen: InspectBox,
  box: InspectBox,
  gap: { readonly x: number; readonly y: number },
): NearbyNote["side"] {
  if (gap.x < 0 && gap.y < 0) {
    return "over";
  }

  if (gap.x >= gap.y) {
    return box.x + box.width / 2 > screen.x + screen.width / 2 ? "right" : "left";
  }

  return box.y + box.height / 2 > screen.y + screen.height / 2 ? "below" : "above";
}
