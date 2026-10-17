/** A released version's numbers, "0.3.10" → [0, 3, 10]; null for a prerelease or anything else. */
function releaseOf(version: string): number[] | null {
  return /^\d+\.\d+\.\d+$/.test(version.trim()) ? version.trim().split(".").map(Number) : null;
}

/** Whether a released version is newer than another, part by part as numbers; never for one it cannot read. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = releaseOf(candidate);
  const now = releaseOf(current);

  if (next === null || now === null) {
    return false;
  }

  const index = next.findIndex((part, at) => part !== now[at]);

  return index !== -1 && (next[index] ?? 0) > (now[index] ?? 0);
}
