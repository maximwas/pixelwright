/** Why this Node.js is too old, or null when it is new enough. Versions are "major.minor.patch". */
export function nodeVersionProblem(version: string, minimum: string): string | null {
  const have = version.split(".").map(Number);
  const need = minimum.split(".").map(Number);

  for (let index = 0; index < need.length; index += 1) {
    const difference = (have[index] ?? 0) - (need[index] ?? 0);

    if (difference !== 0) {
      return difference > 0 ? null : `This tool needs Node.js ${minimum} or newer; you have ${version}.`;
    }
  }

  return null;
}
