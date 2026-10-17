/** A count with its noun, as summaries say it: "1 layer", "3 layers" (pluralize on npm has had no release since 2019). */
export function quantity(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
