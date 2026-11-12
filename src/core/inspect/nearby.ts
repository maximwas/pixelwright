import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { NOTE_SIDE } from "@/shared/ops/nearby/nearby.constants.ts";
import type { NearbyNote } from "@/shared/ops/nearby/nearby.schema.ts";

/** A box on the canvas, in page px. */
export interface CanvasBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A layer on the canvas that may be a note: its box and its texts, top to bottom. */
export interface NoteCandidate {
  readonly id: string;
  readonly name: string;
  readonly box: CanvasBox;
  readonly text: string;
}

/** The gaps between two boxes on each axis: negative where they overlap on it. */
interface Gaps {
  readonly x: number;
  readonly y: number;
}

/**
 * The notes within `distance` px of a screen's box (T-058, K-062), nearest first (the canvas's order among equals):
 * each with the side it is on, over the screen when their boxes overlap, and its gap to the screen; `max` of them,
 * and how many more.
 */
@injectable()
export class NearbyNotes {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  notes(
    screen: CanvasBox,
    candidates: readonly NoteCandidate[],
    limits: { readonly distance: number; readonly max: number },
  ): { notes: NearbyNote[]; more: number } {
    const notes = candidates
      .map((candidate) => this.#note(screen, candidate))
      .filter((note) => note.distance <= limits.distance)
      .sort((first, second) => first.distance - second.distance);

    return { notes: notes.slice(0, limits.max), more: Math.max(0, notes.length - limits.max) };
  }

  #note(screen: CanvasBox, { id, name, box, text }: NoteCandidate): NearbyNote {
    const gaps: Gaps = {
      x: Math.max(box.x - (screen.x + screen.width), screen.x - (box.x + box.width)),
      y: Math.max(box.y - (screen.y + screen.height), screen.y - (box.y + box.height)),
    };

    return {
      id,
      name,
      text,
      side: this.#side(screen, box, gaps),
      distance: this.#format.round(Math.hypot(Math.max(0, gaps.x), Math.max(0, gaps.y)), PRECISION.distance),
    };
  }

  /** The axis the box stands farther off on, or over the screen when they overlap on both (touching is beside). */
  #side(
    screen: CanvasBox,
    box: CanvasBox,
    gaps: Gaps,
  ): NearbyNote["side"] {
    if (gaps.x < 0 && gaps.y < 0) {
      return NOTE_SIDE.over;
    }

    if (gaps.x >= gaps.y) {
      return box.x + box.width / 2 > screen.x + screen.width / 2 ? NOTE_SIDE.right : NOTE_SIDE.left;
    }

    return box.y + box.height / 2 > screen.y + screen.height / 2 ? NOTE_SIDE.below : NOTE_SIDE.above;
  }
}

export const NEARBY_NOTES = new InjectionToken<NearbyNotes>("NearbyNotes");
