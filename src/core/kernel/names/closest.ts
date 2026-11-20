import { closestMatch } from "leven";

/** K-073: the "Did you mean" of an error, within a third of the name's length in edits, at least this many. */
const MIN_DISTANCE = 2;

/** The candidate closest to a name, case ignored; null when none is within max(2, length / 3) edits. */
export class Closest {
  of(name: string, candidates: Iterable<string>): string | null {
    const list = [...candidates];
    const lower = list.map((candidate) => candidate.toLowerCase());
    const found = closestMatch(name.toLowerCase(), lower, {
      maxDistance: Math.max(MIN_DISTANCE, Math.floor(name.length / 3)),
    });

    return found === undefined ? null : (list[lower.indexOf(found)] ?? null);
  }
}
