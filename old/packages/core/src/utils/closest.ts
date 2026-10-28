import { closestMatch } from "leven";

/**
 * The candidate closest to a name, case ignored, within a third of its length in edits (at least 2): the "Did you
 * mean" of an error; null when none is that close.
 */
export function closest(name: string, candidates: Iterable<string>): string | null {
  const list = [...candidates];
  const lower = list.map((candidate) => candidate.toLowerCase());
  const found = closestMatch(name.toLowerCase(), lower, {
    maxDistance: Math.max(2, Math.floor(name.length / 3)),
  });

  return found === undefined ? null : (list[lower.indexOf(found)] ?? null);
}
