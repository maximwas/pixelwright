/** The wanted name, or the first of `-2`, `-3`… that is not taken yet; the name returned is taken from then on. */
export function uniqueName(wanted: string, taken: Set<string>): string {
  let candidate = wanted;

  for (let index = 2; taken.has(candidate); index++) {
    candidate = `${wanted}-${index}`;
  }

  taken.add(candidate);

  return candidate;
}
